-- ============================================================
-- COSSA — DM crypto/authenticity hardening + clear performance
-- 1) Add signing_public_key for E2EE sender authenticity
-- 2) Server-side RPC to clear a DM conversation safely
-- 3) Add index to keep clear/update operation fast at scale
-- ============================================================

-- Sender identity key used to verify E2EE ciphertext signatures.
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS signing_public_key text;

-- Legacy v1 blobs were wrapped using predictable material derived from user id.
-- Remove them so clients re-backup keys using passphrase-derived v2 wrapping.
UPDATE profiles
SET encrypted_private_key = null
WHERE encrypted_private_key IS NOT NULL
  AND encrypted_private_key LIKE '{"v":1,%';

-- Speeds up sender-side DM clear operations.
CREATE INDEX IF NOT EXISTS idx_messages_dm_sender_receiver_clear
ON messages(sender_id, receiver_id, channel_id, deleted_for_sender);

-- Clear only the authenticated sender's messages for one DM peer.
CREATE OR REPLACE FUNCTION clear_dm_conversation(
  p_other_user uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_updated integer := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated', 'updated', 0);
  END IF;

  UPDATE messages
  SET deleted_for_sender = true
  WHERE sender_id = v_user_id
    AND receiver_id = p_other_user
    AND channel_id IS NULL
    AND deleted_for_sender = false;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN json_build_object('ok', true, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION clear_dm_conversation(uuid) TO authenticated;
