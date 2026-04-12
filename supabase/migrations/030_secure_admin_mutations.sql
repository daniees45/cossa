-- ============================================================
-- COSSA — Secure admin mutations with atomic audit logging
-- 1) Move sensitive admin writes into SECURITY DEFINER RPCs
-- 2) Ensure audit logs are written in the same DB transaction
-- ============================================================

CREATE OR REPLACE FUNCTION admin_set_user_role(
  p_target_user_id uuid,
  p_new_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_prev_role text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT role INTO v_actor_role FROM profiles WHERE id = v_actor_id;
  IF v_actor_role IS DISTINCT FROM 'super_admin' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only super admins can change roles');
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot change your own role');
  END IF;

  IF p_new_role NOT IN ('student', 'admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid role');
  END IF;

  SELECT role INTO v_prev_role FROM profiles WHERE id = p_target_user_id;
  IF v_prev_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Target user not found');
  END IF;

  UPDATE profiles
  SET role = p_new_role
  WHERE id = p_target_user_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_actor_id,
    'role_changed',
    'profile',
    p_target_user_id,
    jsonb_build_object('previousRole', v_prev_role, 'newRole', p_new_role)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_user_ban(
  p_target_user_id uuid,
  p_is_banned boolean,
  p_ban_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_target_role text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT role INTO v_actor_role FROM profiles WHERE id = v_actor_id;
  IF v_actor_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  IF p_target_user_id = v_actor_id THEN
    RETURN jsonb_build_object('ok', false, 'error', 'You cannot change your own ban status');
  END IF;

  SELECT role INTO v_target_role FROM profiles WHERE id = p_target_user_id;
  IF v_target_role IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Target user not found');
  END IF;

  -- Only super admins can moderate admin/super_admin accounts.
  IF v_actor_role <> 'super_admin' AND v_target_role IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Only super admins can moderate admins');
  END IF;

  UPDATE profiles
  SET
    is_banned = p_is_banned,
    ban_reason = CASE WHEN p_is_banned THEN NULLIF(trim(COALESCE(p_ban_reason, '')), '') ELSE NULL END
  WHERE id = p_target_user_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_actor_id,
    CASE WHEN p_is_banned THEN 'user_banned' ELSE 'user_unbanned' END,
    'profile',
    p_target_user_id,
    jsonb_build_object('banReason', CASE WHEN p_is_banned THEN NULLIF(trim(COALESCE(p_ban_reason, '')), '') ELSE NULL END)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_set_post_report_status(
  p_report_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_prev_status text;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT role INTO v_actor_role FROM profiles WHERE id = v_actor_id;
  IF v_actor_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  IF p_status NOT IN ('reviewed', 'dismissed') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid status');
  END IF;

  SELECT status::text INTO v_prev_status
  FROM post_reports
  WHERE id = p_report_id;

  IF v_prev_status IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Report not found');
  END IF;

  UPDATE post_reports
  SET status = p_status
  WHERE id = p_report_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_actor_id,
    'report_status_updated',
    'post_report',
    p_report_id,
    jsonb_build_object('previousStatus', v_prev_status, 'newStatus', p_status)
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION admin_delete_post_report(
  p_report_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_exists boolean := false;
BEGIN
  IF v_actor_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authenticated');
  END IF;

  SELECT role INTO v_actor_role FROM profiles WHERE id = v_actor_id;
  IF v_actor_role NOT IN ('admin', 'super_admin') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized');
  END IF;

  SELECT EXISTS(SELECT 1 FROM post_reports WHERE id = p_report_id) INTO v_exists;
  IF NOT v_exists THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Report not found');
  END IF;

  DELETE FROM post_reports WHERE id = p_report_id;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_actor_id,
    'report_deleted',
    'post_report',
    p_report_id,
    '{}'::jsonb
  );

  RETURN jsonb_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION admin_set_user_role(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_user_ban(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_set_post_report_status(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION admin_delete_post_report(uuid) TO authenticated;
