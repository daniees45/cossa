-- ============================================================
-- COSSA — cast_ballot verification checks (manual SQL run)
-- Purpose: verify eligibility and duplicate-position protections.
--
-- How to run:
-- 1) Apply migrations up to 017.
-- 2) Replace the UUID placeholders below with existing profile IDs:
--      - v_admin_id must be admin/super_admin
--      - v_user_id must be a normal user
-- 3) Run this script in Supabase SQL Editor.
-- 4) Script runs inside a transaction and rolls back at the end.
-- ============================================================

BEGIN;

DO $$
DECLARE
  v_admin_id uuid := '00000000-0000-0000-0000-000000000000';
  v_user_id  uuid := '00000000-0000-0000-0000-000000000000';

  v_election_id uuid;
  v_cand_a uuid;
  v_cand_b uuid;
  v_result json;
BEGIN
  IF v_admin_id = '00000000-0000-0000-0000-000000000000'::uuid OR v_user_id = '00000000-0000-0000-0000-000000000000'::uuid THEN
    RAISE EXCEPTION 'Replace v_admin_id and v_user_id placeholders before running.';
  END IF;

  -- Ensure baseline user state
  UPDATE profiles
     SET is_banned = false,
         ban_reason = NULL,
         level = '100',
         index_number = '223CS01000941'
   WHERE id = v_user_id;

  -- Create active election restricted to level 200 initially
  INSERT INTO elections (title, description, status, starts_at, ends_at, eligible_levels, require_index_number, created_by)
  VALUES (
    'TEST: cast_ballot checks',
    'Temp election for SQL verification',
    'active',
    now() - interval '1 hour',
    now() + interval '1 hour',
    ARRAY['200'],
    true,
    v_admin_id
  )
  RETURNING id INTO v_election_id;

  INSERT INTO candidates (election_id, user_id, position, manifesto)
  VALUES (v_election_id, v_admin_id, 'President', 'A')
  RETURNING id INTO v_cand_a;

  INSERT INTO candidates (election_id, user_id, position, manifesto)
  VALUES (v_election_id, v_admin_id, 'President', 'B')
  RETURNING id INTO v_cand_b;

  -- CASE 1: ineligible level should fail
  PERFORM set_config('request.jwt.claim.sub', v_user_id::text, true);
  SELECT cast_ballot(v_election_id, ARRAY[v_cand_a]) INTO v_result;
  IF (v_result->>'ok')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASE 1 failed: expected ineligible-level rejection, got %', v_result;
  END IF;

  -- CASE 2: make user eligible and vote succeeds
  UPDATE profiles SET level = '200' WHERE id = v_user_id;
  SELECT cast_ballot(v_election_id, ARRAY[v_cand_a]) INTO v_result;
  IF (v_result->>'ok')::boolean IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'CASE 2 failed: expected successful vote, got %', v_result;
  END IF;

  -- CASE 3: same-position revote should fail
  SELECT cast_ballot(v_election_id, ARRAY[v_cand_b]) INTO v_result;
  IF (v_result->>'ok')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASE 3 failed: expected duplicate-position rejection, got %', v_result;
  END IF;

  -- CASE 4: banned user should fail
  UPDATE profiles SET is_banned = true, ban_reason = 'test block' WHERE id = v_user_id;
  SELECT cast_ballot(v_election_id, ARRAY[v_cand_a]) INTO v_result;
  IF (v_result->>'ok')::boolean IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'CASE 4 failed: expected banned-user rejection, got %', v_result;
  END IF;

  RAISE NOTICE 'cast_ballot checks passed.';
END $$;

ROLLBACK;
