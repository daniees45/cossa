-- ============================================================
-- COSSA — Profile pictures, avatars, and creative avatar frames
-- 1) Add banner/cover images to profiles
-- 2) Add avatar frames for visual customization
-- 3) Track profile picture history
-- 4) Add avatars to channels
-- ============================================================

-- Add new columns to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS banner_url text,
ADD COLUMN IF NOT EXISTS avatar_frame text DEFAULT 'classic' CHECK (avatar_frame IN ('classic','gold','silver','bronze','rainbow','glow','gradient','retro'));

-- Create table to track profile picture history (for profile galleries)
CREATE TABLE IF NOT EXISTS profile_pictures_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  avatar_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  is_current boolean DEFAULT false
);

ALTER TABLE profile_pictures_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profile_pictures_history_read_all" ON profile_pictures_history FOR SELECT USING (true);
CREATE POLICY "profile_pictures_history_manage_own" ON profile_pictures_history FOR ALL USING (auth.uid() = user_id);

-- Add avatar support to channels
ALTER TABLE channels
ADD COLUMN IF NOT EXISTS avatar_url text,
ADD COLUMN IF NOT EXISTS banner_url text,
ADD COLUMN IF NOT EXISTS emoji_icon text,
ADD COLUMN IF NOT EXISTS color_hex text DEFAULT '#7c3aed';

-- Create table for channel avatars history
CREATE TABLE IF NOT EXISTS channel_avatars_history (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  avatar_url text NOT NULL,
  uploaded_at timestamptz DEFAULT now(),
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL
);

ALTER TABLE channel_avatars_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_avatars_history_read_all" ON channel_avatars_history FOR SELECT USING (true);
CREATE POLICY "channel_avatars_history_manage_admin" ON channel_avatars_history FOR ALL USING (
  EXISTS (
    SELECT 1
    FROM channels c
    WHERE c.id = channel_id
    AND (
      c.created_by = auth.uid()
      OR EXISTS (
        SELECT 1
        FROM channel_members cm
        WHERE cm.channel_id = c.id
        AND cm.user_id = auth.uid()
        AND cm.role = 'admin'
      )
    )
  )
);

-- Create avatar frames table (for gamification/achievements)
CREATE TABLE IF NOT EXISTS avatar_frames (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  frame_type text NOT NULL CHECK (frame_type IN ('gold','silver','bronze','rainbow','glow','gradient','retro','verified','top_contributor')),
  earned_at timestamptz DEFAULT now(),
  reason text,
  UNIQUE(user_id, frame_type)
);

ALTER TABLE avatar_frames ENABLE ROW LEVEL SECURITY;
CREATE POLICY "avatar_frames_read_all" ON avatar_frames FOR SELECT USING (true);
CREATE POLICY "avatar_frames_manage_own" ON avatar_frames FOR ALL USING (auth.uid() = user_id);

-- Trigger to archive old profile pictures to history
CREATE OR REPLACE FUNCTION archive_profile_picture()
RETURNS trigger AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL AND (OLD.avatar_url IS NULL OR OLD.avatar_url <> NEW.avatar_url) THEN
    -- Mark old current picture as not current
    UPDATE profile_pictures_history
    SET is_current = false
    WHERE user_id = NEW.id;

    -- Add new picture as current
    INSERT INTO profile_pictures_history (user_id, avatar_url, is_current)
    VALUES (NEW.id, NEW.avatar_url, true);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_picture_change ON profiles;
CREATE TRIGGER on_profile_picture_change
  AFTER UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION archive_profile_picture();

-- Trigger to archive channel avatars
CREATE OR REPLACE FUNCTION archive_channel_avatar()
RETURNS trigger AS $$
BEGIN
  IF NEW.avatar_url IS NOT NULL AND (OLD.avatar_url IS NULL OR OLD.avatar_url <> NEW.avatar_url) THEN
    INSERT INTO channel_avatars_history (channel_id, avatar_url, uploaded_by)
    VALUES (NEW.id, NEW.avatar_url, auth.uid());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_channel_avatar_change ON channels;
CREATE TRIGGER on_channel_avatar_change
  AFTER UPDATE ON channels
  FOR EACH ROW EXECUTE FUNCTION archive_channel_avatar();

-- RPC to update profile pictures with avatar frame
CREATE OR REPLACE FUNCTION update_profile_picture(
  p_avatar_url text,
  p_banner_url text DEFAULT NULL,
  p_avatar_frame text DEFAULT 'classic'
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  UPDATE profiles
  SET
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    banner_url = COALESCE(p_banner_url, banner_url),
    avatar_frame = COALESCE(p_avatar_frame, avatar_frame)
  WHERE id = v_user_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_profile_picture(text, text, text) TO authenticated;

-- RPC to update channel avatar and color
CREATE OR REPLACE FUNCTION update_channel_avatar(
  p_channel_id uuid,
  p_avatar_url text DEFAULT NULL,
  p_emoji_icon text DEFAULT NULL,
  p_color_hex text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_allowed boolean;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  -- Check if user is channel admin or owner
  SELECT (
    EXISTS (SELECT 1 FROM channels c WHERE c.id = p_channel_id AND c.created_by = v_actor)
    OR EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = p_channel_id
      AND cm.user_id = v_actor
      AND cm.role = 'admin'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Only channel admins can update channel avatar.');
  END IF;

  UPDATE channels
  SET
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    emoji_icon = COALESCE(p_emoji_icon, emoji_icon),
    color_hex = COALESCE(p_color_hex, color_hex)
  WHERE id = p_channel_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_channel_avatar(uuid, text, text, text) TO authenticated;

-- RPC to unlock avatar frame (admin/achievement system)
CREATE OR REPLACE FUNCTION unlock_avatar_frame(
  p_user_id uuid,
  p_frame_type text,
  p_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  -- Only super admins can unlock frames for others
  IF p_user_id <> v_actor THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_actor AND role = 'super_admin') THEN
      RETURN json_build_object('ok', false, 'error', 'Only super admins can unlock frames for others.');
    END IF;
  END IF;

  INSERT INTO avatar_frames (user_id, frame_type, reason)
  VALUES (p_user_id, p_frame_type, p_reason)
  ON CONFLICT (user_id, frame_type) DO NOTHING;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION unlock_avatar_frame(uuid, text, text) TO authenticated;
