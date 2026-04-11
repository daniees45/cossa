-- ============================================================
-- COSSA — Admin Role Management Policy
-- Allows super_admin users to update any profile's role field
-- ============================================================

CREATE POLICY "profiles_update_role_by_superadmin" ON profiles
  FOR UPDATE
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
  );
