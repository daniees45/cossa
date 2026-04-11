-- ============================================================
-- COSSA — Security hardening + ballot alignment
-- 1) Prevent self role/ban escalation on profile updates
-- 2) Align votes table with multi-position ballots
-- 3) Add atomic cast_ballot RPC
-- Run this in Supabase SQL Editor.
-- ============================================================

-- ── 1) Profile update hardening ──────────────────────────────────────────────
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own_safe" ON profiles;

CREATE POLICY "profiles_update_own_safe" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent self role escalation/demotion.
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
    -- Prevent users from setting their own moderation flags.
    AND COALESCE(is_banned, false) = COALESCE((SELECT p.is_banned FROM profiles p WHERE p.id = auth.uid()), false)
    AND COALESCE(ban_reason, '') = COALESCE((SELECT p.ban_reason FROM profiles p WHERE p.id = auth.uid()), '')
  );

-- ── 2) Votes constraint + insert policy for multi-position ballots ───────────
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_election_id_voter_id_key;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_election_voter_candidate_unique;
ALTER TABLE votes ADD CONSTRAINT votes_election_voter_candidate_unique
  UNIQUE (election_id, voter_id, candidate_id);

DROP POLICY IF EXISTS "votes_insert_own" ON votes;
DROP POLICY IF EXISTS "votes_insert_eligible" ON votes;
DROP POLICY IF EXISTS "votes_insert_eligible_per_position" ON votes;

CREATE POLICY "votes_insert_eligible_per_position" ON votes
  FOR INSERT
  WITH CHECK (
    auth.uid() = voter_id
    AND EXISTS (
      SELECT 1
      FROM candidates c
      WHERE c.id = candidate_id
        AND c.election_id = votes.election_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM votes v
      JOIN candidates c_existing ON c_existing.id = v.candidate_id
      JOIN candidates c_new ON c_new.id = votes.candidate_id
      WHERE v.election_id = votes.election_id
        AND v.voter_id = auth.uid()
        AND c_existing.position = c_new.position
    )
    AND (
      (SELECT eligible_levels FROM elections WHERE id = votes.election_id) IS NULL
      OR (SELECT p.level FROM profiles p WHERE p.id = auth.uid())
         = ANY(SELECT unnest(eligible_levels) FROM elections WHERE id = votes.election_id)
    )
    AND (
      NOT (SELECT require_index_number FROM elections WHERE id = votes.election_id)
      OR (SELECT index_number FROM profiles WHERE id = auth.uid()) IS NOT NULL
    )
  );

-- ── 3) Atomic ballot RPC ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cast_ballot(
  p_election_id uuid,
  p_candidate_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_has_ban boolean := false;
  v_status text;
  v_require_index boolean;
  v_eligible_levels text[];
  v_user_level text;
  v_user_index text;
  v_total_candidates int;
  v_total_positions int;
  v_existing_conflict int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  IF p_candidate_ids IS NULL OR array_length(p_candidate_ids, 1) IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'No candidates selected.');
  END IF;

  SELECT is_banned, level, index_number
    INTO v_has_ban, v_user_level, v_user_index
    FROM profiles
   WHERE id = v_user_id;

  IF COALESCE(v_has_ban, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Your account is restricted.');
  END IF;

  SELECT status, require_index_number, eligible_levels
    INTO v_status, v_require_index, v_eligible_levels
    FROM elections
   WHERE id = p_election_id;

  IF v_status IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Election not found.');
  END IF;

  IF v_status <> 'active' THEN
    RETURN json_build_object('ok', false, 'error', 'Voting is not enabled for this election.');
  END IF;

  IF v_require_index AND v_user_index IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Set your index number before voting.');
  END IF;

  IF v_eligible_levels IS NOT NULL AND (v_user_level IS NULL OR NOT (v_user_level = ANY(v_eligible_levels))) THEN
    RETURN json_build_object('ok', false, 'error', 'You are not eligible for this election.');
  END IF;

  -- Ensure all selected candidates belong to the election.
  SELECT COUNT(*)::int
    INTO v_total_candidates
    FROM candidates c
   WHERE c.id = ANY(p_candidate_ids)
     AND c.election_id = p_election_id;

  IF v_total_candidates <> array_length(p_candidate_ids, 1) THEN
    RETURN json_build_object('ok', false, 'error', 'One or more selected candidates are invalid.');
  END IF;

  -- Ensure no duplicate position in the submitted ballot.
  SELECT COUNT(DISTINCT c.position)::int
    INTO v_total_positions
    FROM candidates c
   WHERE c.id = ANY(p_candidate_ids)
     AND c.election_id = p_election_id;

  IF v_total_positions <> array_length(p_candidate_ids, 1) THEN
    RETURN json_build_object('ok', false, 'error', 'Select only one candidate per position.');
  END IF;

  -- Prevent revote for already-voted positions.
  SELECT COUNT(*)::int
    INTO v_existing_conflict
    FROM votes v
    JOIN candidates c_existing ON c_existing.id = v.candidate_id
    JOIN candidates c_new ON c_new.id = ANY(p_candidate_ids)
   WHERE v.election_id = p_election_id
     AND v.voter_id = v_user_id
     AND c_existing.position = c_new.position;

  IF v_existing_conflict > 0 THEN
    RETURN json_build_object('ok', false, 'error', 'You have already voted for one or more selected positions.');
  END IF;

  INSERT INTO votes (election_id, candidate_id, voter_id)
  SELECT p_election_id, cid, v_user_id
  FROM unnest(p_candidate_ids) AS cid;

  RETURN json_build_object('ok', true, 'count', array_length(p_candidate_ids, 1));
END;
$$;

GRANT EXECUTE ON FUNCTION cast_ballot(uuid, uuid[]) TO authenticated;
