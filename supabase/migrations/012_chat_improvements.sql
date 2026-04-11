-- ============================================================
-- COSSA — Chat improvements
-- Edit/delete messages, read receipts, emoji reactions
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Add edited_at column to messages ──────────────────────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at timestamptz;

-- ── Allow senders to edit & delete their own messages ─────
CREATE POLICY "messages_sender_update" ON messages
  FOR UPDATE USING (sender_id = auth.uid());

CREATE POLICY "messages_sender_delete" ON messages
  FOR DELETE USING (sender_id = auth.uid());

-- ── Allow DM receiver to mark messages as read ─────────────
-- (sender can also update via messages_sender_update, so this
--  covers the receiver side for read_at only — enforced at app layer)
CREATE POLICY "messages_receiver_mark_read" ON messages
  FOR UPDATE USING (receiver_id = auth.uid());

-- ── Message reactions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS message_reactions (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji      text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone who can see the conversation can see reactions
CREATE POLICY "reactions_select" ON message_reactions
  FOR SELECT USING (true);

CREATE POLICY "reactions_insert" ON message_reactions
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "reactions_delete" ON message_reactions
  FOR DELETE USING (user_id = auth.uid());

-- ── Storage: chat-media bucket ─────────────────────────────
-- In the Supabase Dashboard → Storage:
--   1. Create a new bucket named exactly: chat-media
--   2. Set it to Public
--   3. Add these storage policies on the bucket:
--      SELECT  → true  (public reads)
--      INSERT  → (auth.uid() = (storage.foldername(name))[1]::uuid)
--      DELETE  → (auth.uid() = (storage.foldername(name))[1]::uuid)
