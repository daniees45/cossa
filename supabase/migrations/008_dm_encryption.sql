-- ============================================================
-- COSSA — DM Encryption + Username Login
-- 1. Add public_key column to profiles (ECDH public key)
-- 2. RPC: get_login_email — resolve username → email for login
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. public_key for E2EE DM
-- Stores each user's ECDH P-256 public key (raw, base64-encoded)
-- so the client can derive a shared AES-GCM key per conversation.
-- ============================================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS public_key text;

-- Users may update their own public key (key rotation)
DROP POLICY IF EXISTS "profiles_update_own_pubkey" ON profiles;
-- Already covered by existing "profiles_update_own" policy.

-- ============================================================
-- 2. RPC: get_login_email(p_identifier text) → text
-- Accepts a username (or falls through to NULL if not found).
-- SECURITY DEFINER so it can read auth.users.
-- The client detects the @ sign — this RPC is only called for
-- username-style identifiers.
-- ============================================================
DROP FUNCTION IF EXISTS get_login_email(text);

CREATE OR REPLACE FUNCTION get_login_email(p_identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
  v_email   text;
BEGIN
  -- Look up profile by normalised username
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE username = lower(trim(p_identifier));

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Fetch the corresponding email from auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  RETURN v_email;
END;
$$;

-- Grant execution to the anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_login_email(text) TO anon, authenticated;
