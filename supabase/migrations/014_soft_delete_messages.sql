-- ============================================================
-- COSSA — Soft delete for messages (sender-side)
-- When recipient has already read a message:
--   • Edit is disallowed (enforced at app layer)
--   • Delete only hides it from the sender (soft delete)
-- When recipient has NOT read it yet:
--   • Hard delete removes it from both sides
-- Run this in Supabase SQL Editor.
-- ============================================================

ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted_for_sender boolean NOT NULL DEFAULT false;

-- Allow sender to flip this flag (covered by existing messages_sender_update policy)
-- No extra policy needed.
