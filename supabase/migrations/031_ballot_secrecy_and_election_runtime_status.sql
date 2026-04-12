-- ============================================================
-- COSSA — Ballot secrecy + runtime election status hardening
-- 1) Decouple voter identity from vote selections
-- 2) Track participation in a separate receipt ledger
-- 3) Simplify voter verification to student ID ownership
-- 4) Compute election status from timestamps at runtime
-- ============================================================

-- ── Runtime status helper (timestamp-driven, no manual transition dependency)
CREATE OR REPLACE FUNCTION election_runtime_status(
  p_starts_at timestamptz,
  p_ends_at timestamptz
)
RETURNS text
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  IF now() < p_starts_at THEN
    RETURN 'draft';
  ELSIF now() >= p_ends_at THEN
    RETURN 'closed';
  END IF;
  RETURN 'active';
END;
$$;

-- ── Participation ledger (separate from ballot selections)
CREATE TABLE IF NOT EXISTS election_vote_receipts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  voter_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receipt_code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (election_id, voter_id)
);

ALTER TABLE election_vote_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vote_receipts_own" ON election_vote_receipts;
CREATE POLICY "vote_receipts_own" ON election_vote_receipts
  FOR SELECT USING (auth.uid() = voter_id);

CREATE INDEX IF NOT EXISTS idx_vote_receipts_voter_election
  ON election_vote_receipts(voter_id, election_id);

-- ── Votes table anonymization
ALTER TABLE votes ADD COLUMN IF NOT EXISTS ballot_id uuid;

UPDATE votes
SET ballot_id = COALESCE(ballot_id, uuid_generate_v4());

-- Backfill participation receipts for historical ballots.
INSERT INTO election_vote_receipts (election_id, voter_id, receipt_code, created_at)
SELECT
  v.election_id,
  v.voter_id,
  substring(replace(uuid_generate_v4()::text, '-', ''), 1, 12),
  min(v.created_at)
FROM votes v
WHERE v.voter_id IS NOT NULL
GROUP BY v.election_id, v.voter_id
ON CONFLICT (election_id, voter_id) DO NOTHING;

DROP POLICY IF EXISTS "votes_insert_own" ON votes;
DROP POLICY IF EXISTS "votes_insert_eligible" ON votes;
DROP POLICY IF EXISTS "votes_insert_eligible_per_position" ON votes;
DROP POLICY IF EXISTS "votes_select_own" ON votes;

ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_election_id_voter_id_key;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_election_voter_candidate_unique;
ALTER TABLE votes DROP CONSTRAINT IF EXISTS votes_election_ballot_candidate_unique;
ALTER TABLE votes ADD CONSTRAINT votes_election_ballot_candidate_unique
  UNIQUE (election_id, ballot_id, candidate_id);

CREATE INDEX IF NOT EXISTS idx_votes_election_ballot
  ON votes(election_id, ballot_id);

ALTER TABLE votes DROP COLUMN IF EXISTS voter_id;
ALTER TABLE votes ALTER COLUMN ballot_id SET NOT NULL;

-- ── Voter-roll schema and verification hardening
ALTER TABLE voter_rolls ALTER COLUMN full_name DROP NOT NULL;

DROP FUNCTION IF EXISTS verify_voter(uuid, text, uuid);
CREATE OR REPLACE FUNCTION verify_voter(
  p_election_id uuid,
  p_student_id text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_roll voter_rolls%ROWTYPE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT * INTO v_roll
  FROM voter_rolls
  WHERE election_id = p_election_id
    AND student_id = UPPER(TRIM(p_student_id));

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Student ID not found in the voter list for this election. Contact the admin if this is an error.'
    );
  END IF;

  IF v_roll.voter_id IS NOT NULL AND v_roll.voter_id <> v_user_id THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'This student ID has already been verified by another account. Contact admin immediately.'
    );
  END IF;

  IF v_roll.voter_id = v_user_id THEN
    RETURN json_build_object('ok', true, 'student_id', v_roll.student_id);
  END IF;

  UPDATE voter_rolls
  SET voter_id = v_user_id
  WHERE id = v_roll.id;

  RETURN json_build_object('ok', true, 'student_id', v_roll.student_id);
END;
$$;

GRANT EXECUTE ON FUNCTION verify_voter(uuid, text) TO authenticated;

-- ── Atomic ballot cast with anonymity and runtime timestamp checks
CREATE OR REPLACE FUNCTION cast_ballot(
  p_election_id uuid,
  p_candidate_ids uuid[]
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_has_ban boolean := false;
  v_starts_at timestamptz;
  v_ends_at timestamptz;
  v_require_index boolean;
  v_eligible_levels text[];
  v_user_level text;
  v_user_index text;
  v_total_candidates int;
  v_total_positions int;
  v_roll_count int;
  v_verified_on_roll boolean;
  v_ballot_id uuid := uuid_generate_v4();
  v_receipt_code text;
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

  SELECT starts_at, ends_at, require_index_number, eligible_levels
    INTO v_starts_at, v_ends_at, v_require_index, v_eligible_levels
    FROM elections
   WHERE id = p_election_id;

  IF v_starts_at IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Election not found.');
  END IF;

  IF now() < v_starts_at THEN
    RETURN json_build_object('ok', false, 'error', 'Voting has not started yet.');
  END IF;

  IF now() >= v_ends_at THEN
    RETURN json_build_object('ok', false, 'error', 'Voting has ended for this election.');
  END IF;

  IF v_require_index AND v_user_index IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Set your index number before voting.');
  END IF;

  IF v_eligible_levels IS NOT NULL AND (v_user_level IS NULL OR NOT (v_user_level = ANY(v_eligible_levels))) THEN
    RETURN json_build_object('ok', false, 'error', 'You are not eligible for this election.');
  END IF;

  SELECT COUNT(*)::int
    INTO v_roll_count
    FROM voter_rolls
   WHERE election_id = p_election_id;

  IF v_roll_count > 0 THEN
    SELECT EXISTS (
      SELECT 1
      FROM voter_rolls
      WHERE election_id = p_election_id
        AND voter_id = v_user_id
    ) INTO v_verified_on_roll;

    IF NOT COALESCE(v_verified_on_roll, false) THEN
      RETURN json_build_object('ok', false, 'error', 'Verify your student ID before voting in this election.');
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM election_vote_receipts r
    WHERE r.election_id = p_election_id
      AND r.voter_id = v_user_id
  ) THEN
    RETURN json_build_object('ok', false, 'error', 'You have already voted in this election.');
  END IF;

  SELECT COUNT(*)::int
    INTO v_total_candidates
    FROM candidates c
   WHERE c.id = ANY(p_candidate_ids)
     AND c.election_id = p_election_id;

  IF v_total_candidates <> array_length(p_candidate_ids, 1) THEN
    RETURN json_build_object('ok', false, 'error', 'One or more selected candidates are invalid.');
  END IF;

  SELECT COUNT(DISTINCT c.position)::int
    INTO v_total_positions
    FROM candidates c
   WHERE c.id = ANY(p_candidate_ids)
     AND c.election_id = p_election_id;

  IF v_total_positions <> array_length(p_candidate_ids, 1) THEN
    RETURN json_build_object('ok', false, 'error', 'Select only one candidate per position.');
  END IF;

  v_receipt_code := substring(replace(uuid_generate_v4()::text, '-', ''), 1, 12);

  INSERT INTO election_vote_receipts (election_id, voter_id, receipt_code)
  VALUES (p_election_id, v_user_id, v_receipt_code)
  ON CONFLICT (election_id, voter_id) DO NOTHING
  RETURNING receipt_code INTO v_receipt_code;

  IF v_receipt_code IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'You have already voted in this election.');
  END IF;

  INSERT INTO votes (election_id, candidate_id, ballot_id)
  SELECT p_election_id, cid, v_ballot_id
  FROM unnest(p_candidate_ids) AS cid;

  RETURN json_build_object(
    'ok', true,
    'count', array_length(p_candidate_ids, 1),
    'receipt_code', v_receipt_code
  );
END;
$$;

GRANT EXECUTE ON FUNCTION cast_ballot(uuid, uuid[]) TO authenticated;
