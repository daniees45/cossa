-- ============================================================
-- COSSA — Feed Improvements
-- 1. post_bookmarks: users can save/unsave posts
-- Run this in Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS post_bookmarks (
  post_id    uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE post_bookmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "bookmarks_own" ON post_bookmarks FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_bookmarks_user ON post_bookmarks(user_id, created_at DESC);
