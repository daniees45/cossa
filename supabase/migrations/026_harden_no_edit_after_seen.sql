-- ============================================================
-- COSSA — Harden no-edit-after-seen enforcement
-- Enforces the rule at database level for both DM and channel messages
-- ============================================================

-- Canonical edit check function
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
BEGIN
  SELECT sender_id, receiver_id, channel_id
  INTO v_msg_sender, v_msg_receiver, v_channel_id
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
      FROM message_views mv
      WHERE mv.message_id = p_message_id
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'Cannot edit message after it has been seen');
    END IF;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION check_can_edit_message(uuid, uuid) TO authenticated;

-- Canonical update RPC with hard check
CREATE OR REPLACE FUNCTION update_message(
  p_message_id uuid,
  p_new_content text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_check json;
  v_updated_count integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  IF NULLIF(trim(p_new_content), '') IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Message cannot be empty');
  END IF;

  v_check := check_can_edit_message(p_message_id, v_user_id);
  IF COALESCE((v_check->>'ok')::boolean, false) = false THEN
    RETURN v_check;
  END IF;

  UPDATE messages
  SET
    content = trim(p_new_content),
    edited_at = now(),
    is_edited = true
  WHERE id = p_message_id
    AND sender_id = v_user_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count = 0 THEN
    RETURN json_build_object('ok', false, 'error', 'Message not found or not editable');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_message(uuid, text) TO authenticated;

-- Trigger-level guard to prevent bypass via direct table updates.
CREATE OR REPLACE FUNCTION prevent_edit_seen_messages_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only apply guard when message content is being changed.
  IF NEW.content IS DISTINCT FROM OLD.content THEN
    -- DM: recipient has seen it
    IF OLD.receiver_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM message_views mv
      WHERE mv.message_id = OLD.id
        AND mv.viewer_id = OLD.receiver_id
    ) THEN
      RAISE EXCEPTION 'Cannot edit message after recipient has seen it';
    END IF;

    -- Channel: any view locks edits
    IF OLD.channel_id IS NOT NULL AND EXISTS (
      SELECT 1
      FROM message_views mv
      WHERE mv.message_id = OLD.id
    ) THEN
      RAISE EXCEPTION 'Cannot edit message after it has been seen';
    END IF;

    NEW.edited_at = COALESCE(NEW.edited_at, now());
    NEW.is_edited = true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_edit_seen_messages_before_update ON messages;
CREATE TRIGGER prevent_edit_seen_messages_before_update
  BEFORE UPDATE ON messages
  FOR EACH ROW
  EXECUTE FUNCTION prevent_edit_seen_messages_trigger();
