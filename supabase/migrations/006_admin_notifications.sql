-- ============================================================
-- COSSA — Admin Broadcast Notifications
-- 1. Allows admins to INSERT notifications for any user
-- 2. RPC function to broadcast efficiently from one call
-- ============================================================

-- Allow admin / super_admin to insert notifications for any user
CREATE POLICY "notifications_insert_by_admin" ON notifications
  FOR INSERT
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'super_admin')
  );

-- RPC: broadcast a notification to all users or a specific set of levels
-- Returns the number of notifications inserted
CREATE OR REPLACE FUNCTION broadcast_notification(
  p_title  text,
  p_body   text,
  p_link   text    DEFAULT NULL,
  p_levels text[]  DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
BEGIN
  -- Guard: only admins may call this
  IF (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  IF p_levels IS NULL OR array_length(p_levels, 1) IS NULL THEN
    -- Broadcast to every user
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT id, 'broadcast', p_title, p_body, p_link
    FROM profiles;
  ELSE
    -- Broadcast to specific levels only
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT id, 'broadcast', p_title, p_body, p_link
    FROM profiles
    WHERE level = ANY(p_levels);
  END IF;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
