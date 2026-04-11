-- ============================================================
-- COSSA — Message read tracking and "no edit after seen" rule
-- Prevents users from editing messages once the recipient has seen them
-- ============================================================

-- Create message_views table to track who has seen each message
CREATE TABLE IF NOT EXISTS message_views (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  viewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at timestamptz DEFAULT now(),
  UNIQUE(message_id, viewer_id)
);

ALTER TABLE message_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "message_views_read_own" ON message_views FOR SELECT USING (
  viewer_id = auth.uid() OR 
  EXISTS (SELECT 1 FROM messages m WHERE m.id = message_id AND m.sender_id = auth.uid())
);
CREATE POLICY "message_views_insert_own" ON message_views FOR INSERT WITH CHECK (auth.uid() = viewer_id);

-- Add edited_at column to track message edits
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- Add is_edited flag for easier filtering
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS is_edited boolean DEFAULT false;

-- Store encrypted private key backup (for multi-device restore while online)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS encrypted_private_key text;

-- Save encrypted private key blob for the authenticated user
CREATE OR REPLACE FUNCTION set_encrypted_private_key(
  p_blob text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  UPDATE profiles
  SET encrypted_private_key = p_blob
  WHERE id = v_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_encrypted_private_key(text) TO authenticated;

-- Read encrypted private key blob for the authenticated user
CREATE OR REPLACE FUNCTION get_encrypted_private_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_blob text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT encrypted_private_key INTO v_blob
  FROM profiles
  WHERE id = v_user_id;

  RETURN v_blob;
END;
$$;

GRANT EXECUTE ON FUNCTION get_encrypted_private_key() TO authenticated;

-- Function to check if message is seen (has been read by recipient)
CREATE OR REPLACE FUNCTION is_message_seen(p_message_id uuid, p_viewer_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM message_views
    WHERE message_id = p_message_id
    AND viewer_id = p_viewer_id
  ) INTO v_exists;
  
  RETURN v_exists;
END;
$$;

GRANT EXECUTE ON FUNCTION is_message_seen(uuid, uuid) TO authenticated;

-- Function to prevent editing of seen messages
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
  v_receiver_seen boolean;
  v_channel_id uuid;
BEGIN
  -- Get message details
  SELECT sender_id, receiver_id, channel_id INTO v_msg_sender, v_msg_receiver, v_channel_id
  FROM messages WHERE id = p_message_id;

  IF v_msg_sender IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Message not found');
  END IF;

  -- Only sender can edit
  IF v_msg_sender <> p_user_id THEN
    RETURN json_build_object('ok', false, 'error', 'Only the sender can edit messages');
  END IF;

  -- For DMs: check if recipient has seen it
  IF v_msg_receiver IS NOT NULL THEN
    v_receiver_seen := is_message_seen(p_message_id, v_msg_receiver);
    IF v_receiver_seen THEN
      RETURN json_build_object('ok', false, 'error', 'Cannot edit message after recipient has seen it');
    END IF;
  END IF;

  -- For channels: check if ANY member has seen it
  IF v_channel_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM message_views WHERE message_id = p_message_id) THEN
      RETURN json_build_object('ok', false, 'error', 'Cannot edit message after it has been seen');
    END IF;
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION check_can_edit_message(uuid, uuid) TO authenticated;

-- RPC to update message with edit check
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
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  -- Check if edit is allowed
  v_check := check_can_edit_message(p_message_id, v_user_id);
  IF (v_check->>'ok')::boolean = false THEN
    RETURN v_check;
  END IF;

  -- Perform the update
  UPDATE messages
  SET
    content = p_new_content,
    edited_at = now(),
    is_edited = true
  WHERE id = p_message_id AND sender_id = v_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_message(uuid, text) TO authenticated;

-- RPC to mark a message as viewed
CREATE OR REPLACE FUNCTION mark_message_viewed(
  p_message_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  INSERT INTO message_views (message_id, viewer_id)
  VALUES (p_message_id, v_user_id)
  ON CONFLICT (message_id, viewer_id) DO NOTHING;

  UPDATE messages
  SET read_at = now()
  WHERE id = p_message_id
  AND receiver_id = v_user_id
  AND read_at IS NULL;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_message_viewed(uuid) TO authenticated;

-- RPC to mark all currently visible channel messages as viewed by the current user
CREATE OR REPLACE FUNCTION mark_channel_messages_viewed(
  p_channel_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  INSERT INTO message_views (message_id, viewer_id)
  SELECT m.id, v_user_id
  FROM messages m
  WHERE m.channel_id = p_channel_id
    AND m.sender_id <> v_user_id
    AND NOT EXISTS (
      SELECT 1 FROM message_views mv
      WHERE mv.message_id = m.id
        AND mv.viewer_id = v_user_id
    );

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION mark_channel_messages_viewed(uuid) TO authenticated;

-- Trigger to automatically track when messages are read
CREATE OR REPLACE FUNCTION on_message_read()
RETURNS trigger AS $$
BEGIN
  IF NEW.read_at IS NOT NULL AND OLD.read_at IS NULL THEN
    INSERT INTO message_views (message_id, viewer_id)
    VALUES (NEW.id, NEW.receiver_id)
    ON CONFLICT (message_id, viewer_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_message_read_status ON messages;
CREATE TRIGGER on_message_read_status
  AFTER UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION on_message_read();

-- View to show message edit status with readable indicator
CREATE OR REPLACE VIEW message_status AS
SELECT
  m.id,
  m.sender_id,
  m.receiver_id,
  m.channel_id,
  m.content,
  m.created_at,
  m.edited_at,
  m.is_edited,
  m.read_at,
  CASE
    WHEN m.is_edited THEN 'edited'
    ELSE 'sent'
  END as status,
  CASE
    WHEN m.receiver_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM message_views mv
      WHERE mv.message_id = m.id
    ) THEN 'read'
    WHEN m.read_at IS NOT NULL THEN 'read'
    ELSE 'unread'
  END as delivery_status,
  (SELECT COUNT(*) FROM message_views WHERE message_id = m.id) as view_count
FROM messages m;
