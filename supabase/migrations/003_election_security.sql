-- ============================================================
-- COSSA — Election Security & Candidate Detail Fields
-- Run AFTER 001_initial_schema.sql and 002_admin_setup.sql
-- ============================================================

-- ── Elections: eligibility controls ──────────────────────────────────────

-- Which levels are allowed to vote (NULL = everyone)
ALTER TABLE elections
  ADD COLUMN IF NOT EXISTS eligible_levels text[] DEFAULT NULL;

-- Only users who have set their index_number can vote
ALTER TABLE elections
  ADD COLUMN IF NOT EXISTS require_index_number boolean NOT NULL DEFAULT false;

-- ── Candidates: extra display fields ─────────────────────────────────────
ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS department text;

ALTER TABLE candidates
  ADD COLUMN IF NOT EXISTS level text;

-- ── Votes RLS: enforce eligibility ───────────────────────────────────────
-- Drop existing insert policy and replace with eligibility-aware one
DROP POLICY IF EXISTS "votes_insert_own" ON votes;

CREATE POLICY "votes_insert_eligible" ON votes
  FOR INSERT
  WITH CHECK (
    -- must be the authenticated user
    auth.uid() = voter_id
    AND
    -- level eligibility: pass if election has no restriction, or user's level is in allowed list
    (
      (SELECT eligible_levels FROM elections WHERE id = election_id) IS NULL
      OR
      (SELECT p.level FROM profiles p WHERE p.id = auth.uid())
        = ANY(SELECT unnest(eligible_levels) FROM elections WHERE id = election_id)
    )
    AND
    -- index_number requirement: pass if not required, or user has one set
    (
      NOT (SELECT require_index_number FROM elections WHERE id = election_id)
      OR
      (SELECT index_number FROM profiles WHERE id = auth.uid()) IS NOT NULL
    )
  );
