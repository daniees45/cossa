-- ============================================================
-- COSSA — Channel creation request workflow
-- Users can request channels, admins approve/reject.
-- ============================================================

CREATE TABLE IF NOT EXISTS channel_creation_requests (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              text NOT NULL,
  description       text,
  type              text NOT NULL DEFAULT 'public' CHECK (type IN ('public', 'private')),
  private_join_mode text NOT NULL DEFAULT 'approval' CHECK (private_join_mode IN ('approval', 'code')),
  private_entry_code text,
  status            text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note       text,
  reviewed_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at       timestamptz,
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_channel_creation_requests_status_created
  ON channel_creation_requests(status, created_at);

CREATE INDEX IF NOT EXISTS idx_channel_creation_requests_requested_by
  ON channel_creation_requests(requested_by, status);

ALTER TABLE channel_creation_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "channel_creation_requests_read" ON channel_creation_requests;
CREATE POLICY "channel_creation_requests_read" ON channel_creation_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "channel_creation_requests_insert_own" ON channel_creation_requests;
CREATE POLICY "channel_creation_requests_insert_own" ON channel_creation_requests
  FOR INSERT WITH CHECK (requested_by = auth.uid());

DROP POLICY IF EXISTS "channel_creation_requests_update_admin" ON channel_creation_requests;
CREATE POLICY "channel_creation_requests_update_admin" ON channel_creation_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'super_admin')
    )
  );

CREATE OR REPLACE FUNCTION request_channel_creation(
  p_name text,
  p_description text DEFAULT NULL,
  p_type text DEFAULT 'public',
  p_private_join_mode text DEFAULT 'approval',
  p_private_entry_code text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_name_slug text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  v_name_slug := regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9-]+', '-', 'g');
  v_name_slug := regexp_replace(v_name_slug, '(^-+|-+$)', '', 'g');

  IF v_name_slug = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Channel name is required.');
  END IF;

  IF p_type NOT IN ('public', 'private') THEN
    RETURN json_build_object('ok', false, 'error', 'Only public/private channels can be requested by users.');
  END IF;

  IF p_private_join_mode NOT IN ('approval', 'code') THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid private join mode.');
  END IF;

  IF p_type = 'private' AND p_private_join_mode = 'code' AND coalesce(trim(p_private_entry_code), '') = '' THEN
    RETURN json_build_object('ok', false, 'error', 'Private code is required for private code-based channels.');
  END IF;

  IF EXISTS (SELECT 1 FROM channels c WHERE lower(c.name) = v_name_slug) THEN
    RETURN json_build_object('ok', false, 'error', 'A channel with this name already exists.');
  END IF;

  INSERT INTO channel_creation_requests(
    requested_by,
    name,
    description,
    type,
    private_join_mode,
    private_entry_code,
    status
  )
  VALUES (
    v_user_id,
    v_name_slug,
    nullif(trim(coalesce(p_description, '')), ''),
    p_type,
    CASE WHEN p_type = 'private' THEN p_private_join_mode ELSE 'approval' END,
    CASE
      WHEN p_type = 'private' AND p_private_join_mode = 'code' THEN nullif(trim(coalesce(p_private_entry_code, '')), '')
      ELSE NULL
    END,
    'pending'
  );

  RETURN json_build_object('ok', true, 'pending', true);
END;
$$;

GRANT EXECUTE ON FUNCTION request_channel_creation(text, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION review_channel_creation_request(
  p_request_id uuid,
  p_approve boolean,
  p_review_note text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_request channel_creation_requests%ROWTYPE;
  v_channel_id uuid;
  v_actor_name text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = v_actor AND p.role IN ('admin', 'super_admin')
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'Not allowed to review channel requests.');
  END IF;

  SELECT * INTO v_request
  FROM channel_creation_requests
  WHERE id = p_request_id;

  SELECT coalesce(full_name, username, 'Admin') INTO v_actor_name
  FROM profiles
  WHERE id = v_actor;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Request not found.');
  END IF;

  IF v_request.status <> 'pending' THEN
    RETURN json_build_object('ok', false, 'error', 'This request has already been reviewed.');
  END IF;

  IF p_approve THEN
    IF EXISTS (SELECT 1 FROM channels c WHERE lower(c.name) = lower(v_request.name)) THEN
      RETURN json_build_object('ok', false, 'error', 'A channel with this name already exists.');
    END IF;

    INSERT INTO channels(
      name,
      description,
      type,
      private_join_mode,
      private_entry_code,
      created_by
    )
    VALUES (
      v_request.name,
      v_request.description,
      v_request.type,
      CASE WHEN v_request.type = 'private' THEN v_request.private_join_mode ELSE 'approval' END,
      CASE
        WHEN v_request.type = 'private' AND v_request.private_join_mode = 'code'
          THEN v_request.private_entry_code
        ELSE NULL
      END,
      v_request.requested_by
    )
    RETURNING id INTO v_channel_id;

    INSERT INTO channel_members(channel_id, user_id, role)
    VALUES (v_channel_id, v_request.requested_by, 'admin')
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    UPDATE channel_creation_requests
      SET status = 'approved',
          reviewed_by = v_actor,
          reviewed_at = now(),
          review_note = nullif(trim(coalesce(p_review_note, '')), '')
      WHERE id = p_request_id;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      v_request.requested_by,
      'channel_creation_approved',
      'Channel request approved',
      coalesce(v_actor_name, 'Admin') || ' approved your request for #' || v_request.name,
      '/chat'
    );

    RETURN json_build_object('ok', true, 'approved', true, 'channel_id', v_channel_id);
  END IF;

  UPDATE channel_creation_requests
    SET status = 'rejected',
        reviewed_by = v_actor,
        reviewed_at = now(),
        review_note = nullif(trim(coalesce(p_review_note, '')), '')
    WHERE id = p_request_id;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_request.requested_by,
    'channel_creation_rejected',
    'Channel request rejected',
    coalesce(v_actor_name, 'Admin') || ' rejected your request for #' || v_request.name,
    '/chat'
  );

  RETURN json_build_object('ok', true, 'approved', false);
END;
$$;

GRANT EXECUTE ON FUNCTION review_channel_creation_request(uuid, boolean, text) TO authenticated;
