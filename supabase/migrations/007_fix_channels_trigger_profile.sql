-- ============================================================
-- COSSA — Fix Three Issues
-- 1. Channels: add admin write / delete RLS policies
-- 2. Auth trigger: robust index_number / level capture
-- 3. Backfill existing auth users who have no profile row
-- Run this in Supabase SQL Editor
-- ============================================================

-- ============================================================
-- FIX 1: Channel RLS — admins must be able to create/edit/delete
-- ============================================================

-- Drop stale policies if they exist so re-running is safe
DROP POLICY IF EXISTS "channels_admin_write"  ON channels;
DROP POLICY IF EXISTS "channels_admin_delete" ON channels;
DROP POLICY IF EXISTS "channel_members_admin" ON channel_members;

-- Admins can INSERT / UPDATE / DELETE any channel
CREATE POLICY "channels_admin_write" ON channels
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- Admins can manage channel membership (add/remove members)
CREATE POLICY "channel_members_admin" ON channel_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
    )
  );

-- ============================================================
-- FIX 2: Auth trigger — capture index_number + level robustly
-- Handles duplicate index_number by pre-checking uniqueness.
-- Uses ON CONFLICT (id) DO UPDATE to backfill existing rows.
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username  text;
  final_username text;
  counter        int := 0;
  v_index        text;
BEGIN
  -- Derive username from metadata or email prefix
  base_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    LOWER(REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'))
  );
  -- Ensure uniqueness
  final_username := base_username;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE username = final_username);
    counter := counter + 1;
    final_username := base_username || counter::text;
    EXIT WHEN counter > 99;
  END LOOP;

  -- Extract index_number; set to NULL if already claimed by another row
  v_index := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'index_number', '')), '');
  IF v_index IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM profiles WHERE index_number = v_index AND id <> NEW.id) THEN
      v_index := NULL;  -- claimed by someone else — clear it
    END IF;
  END IF;

  INSERT INTO profiles (id, username, full_name, avatar_url, index_number, level)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), final_username),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')), ''),
    v_index,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'level', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
    SET
      index_number = COALESCE(profiles.index_number, EXCLUDED.index_number),
      level        = COALESCE(profiles.level,        EXCLUDED.level),
      full_name    = CASE
                       WHEN profiles.full_name IS NULL OR profiles.full_name = ''
                       THEN EXCLUDED.full_name
                       ELSE profiles.full_name
                     END;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE LOG 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- FIX 3: Backfill — create profile rows for any auth.users
-- that do NOT have a matching profiles row yet.
-- ============================================================
DO $$
DECLARE
  u RECORD;
  base_username  text;
  final_username text;
  counter        int;
  v_index        text;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = au.id)
  LOOP
    counter := 0;
    base_username := COALESCE(
      NULLIF(TRIM(u.raw_user_meta_data->>'username'), ''),
      LOWER(REGEXP_REPLACE(split_part(u.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'))
    );
    final_username := base_username;
    LOOP
      EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE username = final_username);
      counter := counter + 1;
      final_username := base_username || counter::text;
      EXIT WHEN counter > 99;
    END LOOP;

    v_index := NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'index_number', '')), '');
    IF v_index IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM profiles WHERE index_number = v_index) THEN
        v_index := NULL;
      END IF;
    END IF;

    INSERT INTO profiles (id, username, full_name, avatar_url, index_number, level)
    VALUES (
      u.id,
      final_username,
      COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''), final_username),
      NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'avatar_url', '')), ''),
      v_index,
      NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'level', '')), '')
    )
    ON CONFLICT (id) DO NOTHING;
  END LOOP;
END $$;
