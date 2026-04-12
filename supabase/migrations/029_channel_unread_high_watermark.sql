-- ============================================================
-- COSSA — Channel unread/read progress high-watermark model
-- 1) Add per-member channel read high-watermark
-- 2) Provide unread-count RPC for offline bootstrap
-- 3) Replace heavy seen-writes with single timestamp update
-- 4) Preserve no-edit-after-seen using high-watermark checks
-- ============================================================

ALTER TABLE channel_members
ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

UPDATE channel_members
SET last_seen_at = COALESCE(last_seen_at, now());

CREATE OR REPLACE FUNCTION mark_channel_read_progress(
  p_channel_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  UPDATE channel_members
  SET last_seen_at = now()
  WHERE channel_id = p_channel_id
    AND user_id = v_user_id;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Not a channel member');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_channel_read_progress(uuid) TO authenticated;

-- Keep old RPC name available for backward compatibility.
CREATE OR REPLACE FUNCTION mark_channel_messages_viewed(
  p_channel_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN mark_channel_read_progress(p_channel_id);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_channel_messages_viewed(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION get_channel_unread_counts()
RETURNS TABLE(channel_id uuid, unread_count bigint)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    cm.channel_id,
    COUNT(m.id)::bigint AS unread_count
  FROM channel_members cm
  LEFT JOIN messages m
    ON m.channel_id = cm.channel_id
   AND m.sender_id <> cm.user_id
   AND m.created_at > COALESCE(cm.last_seen_at, 'epoch'::timestamptz)
  WHERE cm.user_id = auth.uid()
  GROUP BY cm.channel_id;
$$;

GRANT EXECUTE ON FUNCTION get_channel_unread_counts() TO authenticated;

-- Rebind edit guard to high-watermark for channel messages.
CREATE OR REPLACE FUNCTION check_can_edit_message(
  p_message_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_msg_sender uuid;
  v_msg_receiver uuid;
  v_channel_id uuid;
  v_created_at timestamptz;
BEGIN
  SELECT sender_id, receiver_id, channel_id, created_at
  INTO v_msg_sender, v_msg_receiver, v_channel_id, v_created_at
  FROM messages
  WHERE id = p_message_id;

  IF v_msg_sender IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Message not found');
  END IF;

  IF v_msg_sender <> p_user_id THEN
    RETURN json_build_object('ok', false, 'error', 'Only the sender can edit messages');
  END IF;

  IF v_msg_receiver IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM message_views mv
      WHERE mv.message_id = p_message_id
        AND mv.viewer_id = v_msg_receiver
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'Cannot edit message after recipient has seen it');
    END IF;
  END IF;

  IF v_channel_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = v_channel_id
        AND cm.user_id <> v_msg_sender
        AND COALESCE(cm.last_seen_at, 'epoch'::timestamptz) >= v_created_at
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'Cannot edit message after it has been seen');
    END IF;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION check_can_edit_message(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION prevent_edit_seen_messages_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    IF OLD.receiver_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM message_views mv
      WHERE mv.message_id = OLD.id
        AND mv.viewer_id = OLD.receiver_id
    ) THEN
      RAISE EXCEPTION 'Cannot edit message after recipient has seen it';
    END IF;

    IF OLD.channel_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = OLD.channel_id
        AND cm.user_id <> OLD.sender_id
        AND COALESCE(cm.last_seen_at, 'epoch'::timestamptz) >= OLD.created_at
    ) THEN
      RAISE EXCEPTION 'Cannot edit message after it has been seen';
    END IF;

    NEW.edited_at = COALESCE(NEW.edited_at, now());
    NEW.is_edited = true;
  END IF;

  RETURN NEW;
END;
$$;
