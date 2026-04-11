-- ============================================================
-- COSSA — Fix messages SELECT RLS policy
-- The original policy required channel_members membership to
-- read others' channel messages. Users were never auto-joined,
-- so re-visiting a channel only showed your own messages.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "messages_read_own" ON messages;

-- New policy: read DMs you're party to, or any message in a public channel
CREATE POLICY "messages_read_own" ON messages
  FOR SELECT USING (
    -- DMs: sender or receiver
    sender_id = auth.uid() OR
    receiver_id = auth.uid() OR
    -- Public channel messages: any authenticated user
    (channel_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM channels WHERE id = messages.channel_id AND type = 'public'
    ))
  );
