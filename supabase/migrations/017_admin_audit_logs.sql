-- ============================================================
-- COSSA — Admin Audit Logs
-- 1) Create admin_audit_logs table
-- 2) Add RLS so only admins can read logs
-- 3) Add log_admin_action RPC for server/client admin actions
-- Run this in Supabase SQL Editor.
-- ============================================================

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action      text NOT NULL,
  target_type text NOT NULL,
  target_id   uuid,
  details     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target ON admin_audit_logs(target_type, target_id);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_audit_read_admins" ON admin_audit_logs;
CREATE POLICY "admin_audit_read_admins" ON admin_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "admin_audit_insert_admins" ON admin_audit_logs;
CREATE POLICY "admin_audit_insert_admins" ON admin_audit_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
    AND admin_id = auth.uid()
  );

CREATE OR REPLACE FUNCTION log_admin_action(
  p_action text,
  p_target_type text,
  p_target_id uuid DEFAULT NULL,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_id uuid;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = v_admin_id AND role IN ('admin', 'super_admin')
  ) INTO v_is_admin;

  IF v_admin_id IS NULL OR NOT COALESCE(v_is_admin, false) THEN
    RAISE EXCEPTION 'Not authorized to write admin audit log.';
  END IF;

  INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (v_admin_id, p_action, p_target_type, p_target_id, COALESCE(p_details, '{}'::jsonb))
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_admin_action(text, text, uuid, jsonb) TO authenticated;
