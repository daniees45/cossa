-- ============================================================
-- COSSA — Channel admin governance
-- 1) Private join approvals are handled by channel admins/owner
-- 2) Channel admins can rename channels, manage members and roles
-- 3) Owner cannot be removed by others; owner may leave only by self action
-- ============================================================

-- Ensure channel creators are represented as admins in channel_members
INSERT INTO channel_members(channel_id, user_id, role)
SELECT c.id, c.created_by, 'admin'
FROM channels c
LEFT JOIN channel_members cm ON cm.channel_id = c.id AND cm.user_id = c.created_by
WHERE cm.user_id IS NULL
ON CONFLICT (channel_id, user_id) DO NOTHING;

UPDATE channel_members cm
SET role = 'admin'
FROM channels c
WHERE c.id = cm.channel_id
  AND c.created_by = cm.user_id
  AND cm.role <> 'admin';

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
  v_actor_name text;
  v_channel_name text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT (
    EXISTS (SELECT 1 FROM channels c WHERE c.id = p_channel_id AND c.created_by = v_actor)
    OR EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = p_channel_id
        AND cm.user_id = v_actor
        AND cm.role = 'admin'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Only channel admins can review this request.');
  END IF;

  SELECT coalesce(full_name, username, 'Channel admin') INTO v_actor_name
  FROM profiles
  WHERE id = v_actor;

  SELECT name INTO v_channel_name
  FROM channels
  WHERE id = p_channel_id;

  IF p_approve THEN
    INSERT INTO channel_members(channel_id, user_id)
    VALUES (p_channel_id, p_user_id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;

    UPDATE channel_join_requests
      SET status = 'approved', reviewed_by = v_actor, reviewed_at = now()
      WHERE channel_id = p_channel_id AND user_id = p_user_id;

    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      p_user_id,
      'channel_join_approved',
      'Channel join approved',
      coalesce(v_actor_name, 'Channel admin') || ' approved your request to join #' || coalesce(v_channel_name, 'channel'),
      '/chat/' || p_channel_id
    );

    RETURN json_build_object('ok', true, 'approved', true);
  END IF;

  UPDATE channel_join_requests
    SET status = 'rejected', reviewed_by = v_actor, reviewed_at = now()
    WHERE channel_id = p_channel_id AND user_id = p_user_id;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    p_user_id,
    'channel_join_rejected',
    'Channel join rejected',
    coalesce(v_actor_name, 'Channel admin') || ' rejected your request to join #' || coalesce(v_channel_name, 'channel'),
    '/chat'
  );

  RETURN json_build_object('ok', true, 'approved', false);
END;
$$;

GRANT EXECUTE ON FUNCTION review_channel_join_request(uuid, uuid, boolean) TO authenticated;

CREATE OR REPLACE FUNCTION update_channel_details(
  p_channel_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_channel channels%ROWTYPE;
  v_name_slug text;
  v_allowed boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT * INTO v_channel FROM channels WHERE id = p_channel_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Channel not found.');
  END IF;

  SELECT (
    v_channel.created_by = v_actor
    OR EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = p_channel_id
        AND cm.user_id = v_actor
        AND cm.role = 'admin'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Only channel admins can edit channel details.');
  END IF;

  v_name_slug := NULL;
  IF p_name IS NOT NULL THEN
    v_name_slug := regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9-]+', '-', 'g');
    v_name_slug := regexp_replace(v_name_slug, '(^-+|-+$)', '', 'g');
    IF v_name_slug = '' THEN
      RETURN json_build_object('ok', false, 'error', 'Channel name cannot be empty.');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM channels c
      WHERE lower(c.name) = v_name_slug
        AND c.id <> p_channel_id
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'A channel with this name already exists.');
    END IF;
  END IF;

  UPDATE channels
  SET
    name = COALESCE(v_name_slug, name),
    description = CASE
      WHEN p_description IS NULL THEN description
      ELSE nullif(trim(p_description), '')
    END
  WHERE id = p_channel_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_channel_details(uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION set_channel_member_role(
  p_channel_id uuid,
  p_user_id uuid,
  p_role text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_allowed boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  IF p_role NOT IN ('member', 'admin') THEN
    RETURN json_build_object('ok', false, 'error', 'Invalid role.');
  END IF;

  SELECT created_by INTO v_owner FROM channels WHERE id = p_channel_id;
  IF v_owner IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Channel not found.');
  END IF;

  SELECT (
    v_owner = v_actor
    OR EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = p_channel_id
        AND cm.user_id = v_actor
        AND cm.role = 'admin'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Only channel admins can manage roles.');
  END IF;

  IF p_user_id = v_owner AND p_role <> 'admin' THEN
    RETURN json_build_object('ok', false, 'error', 'Channel owner must remain admin.');
  END IF;

  UPDATE channel_members
  SET role = p_role
  WHERE channel_id = p_channel_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'User is not a channel member.');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION set_channel_member_role(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION remove_channel_member(
  p_channel_id uuid,
  p_user_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_owner uuid;
  v_allowed boolean := false;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT created_by INTO v_owner FROM channels WHERE id = p_channel_id;
  IF v_owner IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Channel not found.');
  END IF;

  -- Owner cannot be removed by others.
  IF p_user_id = v_owner AND v_actor <> v_owner THEN
    RETURN json_build_object('ok', false, 'error', 'Channel owner can only leave by themselves.');
  END IF;

  -- Self-leave is allowed for any member.
  IF p_user_id = v_actor THEN
    DELETE FROM channel_members
    WHERE channel_id = p_channel_id
      AND user_id = p_user_id;

    IF NOT FOUND THEN
      RETURN json_build_object('ok', false, 'error', 'User is not a channel member.');
    END IF;

    RETURN json_build_object('ok', true, 'self_left', true);
  END IF;

  SELECT (
    v_owner = v_actor
    OR EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = p_channel_id
        AND cm.user_id = v_actor
        AND cm.role = 'admin'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Only channel admins can remove members.');
  END IF;

  DELETE FROM channel_members
  WHERE channel_id = p_channel_id
    AND user_id = p_user_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'User is not a channel member.');
  END IF;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION remove_channel_member(uuid, uuid) TO authenticated;
