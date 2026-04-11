-- ============================================================
-- COSSA — Voter Roll (student ID gate for elections)
-- Run this in Supabase SQL Editor
-- ============================================================

-- ── Table ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS voter_rolls (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  student_id  text NOT NULL,          -- stored uppercase e.g. "CS/2020/001"
  full_name   text NOT NULL,          -- as in school records
  voter_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,  -- set when student verifies
  created_at  timestamptz DEFAULT now(),
  UNIQUE (election_id, student_id),
  UNIQUE (election_id, voter_id)      -- one account per student ID per election
);

ALTER TABLE voter_rolls ENABLE ROW LEVEL SECURITY;

-- Admins manage voter rolls
CREATE POLICY "voter_rolls_admin" ON voter_rolls
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- Students can only see their own verified entry (to check pre-verified state)
CREATE POLICY "voter_rolls_own" ON voter_rolls
  FOR SELECT USING (voter_id = auth.uid());


-- ── Safe count RPC (SECURITY DEFINER — bypasses RLS, returns count only) ──────
CREATE OR REPLACE FUNCTION get_voter_roll_count(p_election_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT COUNT(*)::int FROM voter_rolls WHERE election_id = p_election_id;
$$;


-- ── Verification RPC ───────────────────────────────────────
-- Called from the ballot page: checks student ID + name match, then claims the row.
CREATE OR REPLACE FUNCTION verify_voter(
  p_election_id uuid,
  p_student_id  text,
  p_user_id     uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_roll         voter_rolls%ROWTYPE;
  v_profile_name text;
  v_roll_norm    text;
  v_prof_norm    text;
  v_first        text;
  v_last         text;
BEGIN
  -- Look up by normalised student ID
  SELECT * INTO v_roll
    FROM voter_rolls
   WHERE election_id = p_election_id
     AND student_id  = UPPER(TRIM(p_student_id));

  IF NOT FOUND THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'Student ID not found in the voter list for this election. Contact the admin if you believe this is an error.'
    );
  END IF;

  -- Already claimed by a different account
  IF v_roll.voter_id IS NOT NULL AND v_roll.voter_id <> p_user_id THEN
    RETURN json_build_object(
      'ok', false,
      'error', 'This student ID has already been verified by another account. Contact admin immediately.'
    );
  END IF;

  -- Same account already verified — idempotent
  IF v_roll.voter_id = p_user_id THEN
    RETURN json_build_object('ok', true, 'name', v_roll.full_name);
  END IF;

  -- Fetch profile name
  SELECT full_name INTO v_profile_name FROM profiles WHERE id = p_user_id;

  -- Normalise both names
  v_roll_norm := LOWER(TRIM(REGEXP_REPLACE(v_roll.full_name, '\s+', ' ', 'g')));
  v_prof_norm := LOWER(TRIM(REGEXP_REPLACE(v_profile_name, '\s+', ' ', 'g')));

  IF v_roll_norm <> v_prof_norm THEN
    -- Lenient match: first and last word of the voter-roll name both appear in profile name
    v_first := LOWER(SPLIT_PART(v_roll_norm, ' ', 1));
    v_last  := LOWER(SPLIT_PART(v_roll_norm, ' ',
                 ARRAY_LENGTH(STRING_TO_ARRAY(v_roll_norm, ' '), 1)));

    IF NOT (
      v_prof_norm ILIKE ('%' || v_first || '%') AND
      v_prof_norm ILIKE ('%' || v_last  || '%')
    ) THEN
      RETURN json_build_object(
        'ok', false,
        'error', 'Your profile name does not match the name on school record for this student ID. Update your profile full name to match exactly, then try again.'
      );
    END IF;
  END IF;

  -- Claim the entry
  UPDATE voter_rolls SET voter_id = p_user_id WHERE id = v_roll.id;

  RETURN json_build_object('ok', true, 'name', v_roll.full_name);
END;
$$;
