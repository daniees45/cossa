-- ============================================================
-- COSSA — Reports & Bans
-- 1. is_banned flag on profiles (admin-controlled)
-- 2. post_reports table (users can report posts)
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ── Banned flag ───────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ban_reason text;

-- Only admins can update is_banned / ban_reason
CREATE POLICY "profiles_admin_ban" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin','super_admin')
    )
  )
  WITH CHECK (true);

-- ── Post reports ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS post_reports (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id     uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      text NOT NULL CHECK (reason IN ('spam','inappropriate','harassment','misinformation','other')),
  note        text,
  status      text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','reviewed','dismissed')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (post_id, reporter_id)
);

ALTER TABLE post_reports ENABLE ROW LEVEL SECURITY;

-- Anyone logged-in can submit a report
CREATE POLICY "reports_insert_own" ON post_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

-- Reporter can see their own reports; admins see all
CREATE POLICY "reports_select" ON post_reports
  FOR SELECT USING (
    auth.uid() = reporter_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin','super_admin')
    )
  );

-- Only admins can update (change status)
CREATE POLICY "reports_admin_update" ON post_reports
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin','super_admin')
    )
  );

-- Only admins can delete
CREATE POLICY "reports_admin_delete" ON post_reports
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin','super_admin')
    )
  );
