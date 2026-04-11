-- ============================================================
-- COSSA — Private channel join security
-- 1) Add private join mode + entry code fields
-- 2) Add channel join requests table
-- 3) Add secure RPCs for join request and approval flow
-- ============================================================

-- Channel privacy controls
ALTER TABLE channels ADD COLUMN IF NOT EXISTS private_join_mode text NOT NULL DEFAULT 'approval'
  CHECK (private_join_mode IN ('approval', 'code'));
ALTER TABLE channels ADD COLUMN IF NOT EXISTS private_entry_code text;

-- Join requests (used for approval flow)
CREATE TABLE IF NOT EXISTS channel_join_requests (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id  uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  request_note text,
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (channel_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_channel_join_requests_channel_status ON channel_join_requests(channel_id, status);
CREATE INDEX IF NOT EXISTS idx_channel_join_requests_user_status ON channel_join_requests(user_id, status);

ALTER TABLE channel_join_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_join_requests_read" ON channel_join_requests;
CREATE POLICY "channel_join_requests_read" ON channel_join_requests
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "channel_join_requests_insert_own" ON channel_join_requests;
CREATE POLICY "channel_join_requests_insert_own" ON channel_join_requests
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

DROP POLICY IF EXISTS "channel_join_requests_review" ON channel_join_requests;
CREATE POLICY "channel_join_requests_review" ON channel_join_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM channels c
      WHERE c.id = channel_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

-- Discoverability: allow read of channel metadata to everyone.
DROP POLICY IF EXISTS "channels_read_members" ON channels;
CREATE POLICY "channels_read_all" ON channels FOR SELECT USING (true);

-- Secure self-service join flow for channels
CREATE OR REPLACE FUNCTION request_channel_join(
  p_channel_id uuid,
  p_entry_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_channel channels%ROWTYPE;
  v_is_member boolean := false;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT * INTO v_channel FROM channels WHERE id = p_channel_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Channel not found.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM channel_members cm
    WHERE cm.channel_id = p_channel_id AND cm.user_id = v_user_id
  ) INTO v_is_member;

  IF v_is_member THEN
    RETURN json_build_object('ok', true, 'joined', true, 'already_member', true);
  END IF;

  IF v_channel.type = 'public' THEN
    INSERT INTO channel_members(channel_id, user_id)
    VALUES (p_channel_id, v_user_id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    RETURN json_build_object('ok', true, 'joined', true, 'pending', false);
  END IF;

  IF v_channel.type = 'announcement' THEN
    RETURN json_build_object('ok', false, 'error', 'Announcement channels are managed by admins.');
  END IF;

  -- private channels
  IF v_channel.private_join_mode = 'code' THEN
    IF COALESCE(TRIM(p_entry_code), '') = '' THEN
      RETURN json_build_object('ok', false, 'error', 'Entry code is required for this channel.');
    END IF;

    IF COALESCE(v_channel.private_entry_code, '') = '' THEN
      RETURN json_build_object('ok', false, 'error', 'This private channel is missing an entry code. Contact admin.');
    END IF;

    IF p_entry_code <> v_channel.private_entry_code THEN
      RETURN json_build_object('ok', false, 'error', 'Invalid entry code.');
    END IF;

    INSERT INTO channel_members(channel_id, user_id)
    VALUES (p_channel_id, v_user_id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    INSERT INTO channel_join_requests(channel_id, user_id, status, reviewed_by, reviewed_at)
    VALUES (p_channel_id, v_user_id, 'approved', v_user_id, now())
    ON CONFLICT (channel_id, user_id) DO UPDATE SET
      status = 'approved',
      reviewed_by = v_user_id,
      reviewed_at = now();

    RETURN json_build_object('ok', true, 'joined', true, 'pending', false);
  END IF;

  INSERT INTO channel_join_requests(channel_id, user_id, status)
  VALUES (p_channel_id, v_user_id, 'pending')
  ON CONFLICT (channel_id, user_id) DO UPDATE SET
    status = 'pending',
    reviewed_by = NULL,
    reviewed_at = NULL;

  RETURN json_build_object('ok', true, 'joined', false, 'pending', true);
END;
$$;

GRANT EXECUTE ON FUNCTION request_channel_join(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION review_channel_join_request(
  p_channel_id uuid,
  p_user_id uuid,
  p_approve boolean
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_allowed boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT (
    EXISTS (SELECT 1 FROM channels c WHERE c.id = p_channel_id AND c.created_by = v_actor)
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = v_actor AND p.role IN ('admin', 'super_admin'))
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Not allowed to review this request.');
  END IF;

  IF p_approve THEN
    INSERT INTO channel_members(channel_id, user_id)
    VALUES (p_channel_id, p_user_id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    UPDATE channel_join_requests
      SET status = 'approved', reviewed_by = v_actor, reviewed_at = now()
      WHERE channel_id = p_channel_id AND user_id = p_user_id;

    RETURN json_build_object('ok', true, 'approved', true);
  END IF;

  UPDATE channel_join_requests
    SET status = 'rejected', reviewed_by = v_actor, reviewed_at = now()
    WHERE channel_id = p_channel_id AND user_id = p_user_id;

  RETURN json_build_object('ok', true, 'approved', false);
END;
$$;

GRANT EXECUTE ON FUNCTION review_channel_join_request(uuid, uuid, boolean) TO authenticated;
