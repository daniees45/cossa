-- ============================================================
-- COSSA — Vote Feature Improvements
-- 1. Allow voters to SELECT their own vote row (for vote receipt UI)
-- Run this in Supabase SQL Editor
-- ============================================================

-- Voters can read their own vote record so we can show a receipt screen
CREATE POLICY "votes_select_own" ON votes
  FOR SELECT USING (auth.uid() = voter_id);
