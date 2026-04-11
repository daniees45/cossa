-- ============================================================
-- COSSA Platform — Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- CLEANUP — drops all existing policies so this script is
-- safe to re-run after a partial/failed migration
-- ============================================================
DO $$ DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      text UNIQUE NOT NULL,
  full_name     text NOT NULL,
  avatar_url    text,
  bio           text,
  level         text CHECK (level IN ('100','200','300','400','postgrad')),
  department    text DEFAULT 'Computer Science',
  role          text NOT NULL DEFAULT 'student' CHECK (role IN ('student','admin','super_admin')),
  index_number  text UNIQUE CHECK (index_number ~ '^[0-9]{3}[A-Z]{2}[0-9]{8}$'),
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_read_all" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  base_username text;
  final_username text;
  counter int := 0;
BEGIN
  base_username := COALESCE(
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    LOWER(REGEXP_REPLACE(split_part(NEW.email, '@', 1), '[^a-zA-Z0-9_]', '', 'g'))
  );
  -- Ensure uniqueness by appending a number if needed
  final_username := base_username;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM profiles WHERE username = final_username);
    counter := counter + 1;
    final_username := base_username || counter::text;
    EXIT WHEN counter > 99;
  END LOOP;

  INSERT INTO profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    final_username,
    COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''), final_username),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')), '')
  )
  ON CONFLICT (id) DO NOTHING;

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
-- FOLLOWERS
-- ============================================================
CREATE TABLE IF NOT EXISTS followers (
  follower_id   uuid REFERENCES profiles(id) ON DELETE CASCADE,
  following_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (follower_id, following_id)
);

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "followers_read_all" ON followers FOR SELECT USING (true);
CREATE POLICY "followers_manage_own" ON followers FOR ALL USING (auth.uid() = follower_id);

-- ============================================================
-- POSTS
-- ============================================================
CREATE TABLE IF NOT EXISTS posts (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content        text NOT NULL,
  media_urls     text[],
  type           text NOT NULL DEFAULT 'post' CHECK (type IN ('post','meme','achievement','event_post')),
  likes_count    int NOT NULL DEFAULT 0,
  comments_count int NOT NULL DEFAULT 0,
  pinned         boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now()
);

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "posts_read_all"   ON posts FOR SELECT USING (true);
CREATE POLICY "posts_insert_own" ON posts FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "posts_update_own" ON posts FOR UPDATE USING (auth.uid() = author_id);
CREATE POLICY "posts_delete_own" ON posts FOR DELETE USING (auth.uid() = author_id);

CREATE TABLE IF NOT EXISTS post_likes (
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "likes_read_all"    ON post_likes FOR SELECT USING (true);
CREATE POLICY "likes_manage_own"  ON post_likes FOR ALL USING (auth.uid() = user_id);

-- Trigger: sync likes_count
CREATE OR REPLACE FUNCTION sync_likes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET likes_count = likes_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET likes_count = likes_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_like_change ON post_likes;
CREATE TRIGGER on_like_change
  AFTER INSERT OR DELETE ON post_likes
  FOR EACH ROW EXECUTE FUNCTION sync_likes_count();

CREATE TABLE IF NOT EXISTS post_comments (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    text NOT NULL,
  parent_id  uuid REFERENCES post_comments(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_read_all"   ON post_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert_own" ON post_comments FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "comments_delete_own" ON post_comments FOR DELETE USING (auth.uid() = author_id);

-- Trigger: sync comments_count
CREATE OR REPLACE FUNCTION sync_comments_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET comments_count = comments_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET comments_count = comments_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_comment_change ON post_comments;
CREATE TRIGGER on_comment_change
  AFTER INSERT OR DELETE ON post_comments
  FOR EACH ROW EXECUTE FUNCTION sync_comments_count();

-- ============================================================
-- ELECTIONS + VOTING
-- ============================================================
CREATE TABLE IF NOT EXISTS elections (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       text NOT NULL,
  description text,
  banner_url  text,
  status      text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','closed')),
  starts_at   timestamptz NOT NULL,
  ends_at     timestamptz NOT NULL,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE elections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "elections_read_all"    ON elections FOR SELECT USING (true);
CREATE POLICY "elections_admin_write" ON elections FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE TABLE IF NOT EXISTS candidates (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  position    text NOT NULL,
  manifesto   text,
  photo_url   text,
  votes_count int NOT NULL DEFAULT 0
);

ALTER TABLE candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "candidates_read_all"    ON candidates FOR SELECT USING (true);
CREATE POLICY "candidates_admin_write" ON candidates FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE TABLE IF NOT EXISTS votes (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  election_id uuid NOT NULL REFERENCES elections(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  voter_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (election_id, voter_id)
);

ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votes_insert_own" ON votes FOR INSERT WITH CHECK (auth.uid() = voter_id);
-- No SELECT policy — secret ballot

-- Trigger: sync votes_count on candidates
CREATE OR REPLACE FUNCTION sync_votes_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE candidates SET votes_count = votes_count + 1 WHERE id = NEW.candidate_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_vote ON votes;
CREATE TRIGGER on_vote
  AFTER INSERT ON votes
  FOR EACH ROW EXECUTE FUNCTION sync_votes_count();

-- ============================================================
-- EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS events (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       text NOT NULL,
  description text,
  cover_url   text,
  type        text NOT NULL DEFAULT 'social_event' CHECK (type IN ('social_event','competition','seminar','fun')),
  location    text,
  event_date  timestamptz NOT NULL,
  rsvp_count  int NOT NULL DEFAULT 0,
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_read_all"    ON events FOR SELECT USING (true);
CREATE POLICY "events_admin_write" ON events FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE TABLE IF NOT EXISTS event_rsvps (
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  user_id  uuid REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (event_id, user_id)
);

ALTER TABLE event_rsvps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rsvp_read_all"    ON event_rsvps FOR SELECT USING (true);
CREATE POLICY "rsvp_manage_own"  ON event_rsvps FOR ALL USING (auth.uid() = user_id);

-- Trigger: sync rsvp_count
CREATE OR REPLACE FUNCTION sync_rsvp_count()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = NEW.event_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE events SET rsvp_count = rsvp_count - 1 WHERE id = OLD.event_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_rsvp_change ON event_rsvps;
CREATE TRIGGER on_rsvp_change
  AFTER INSERT OR DELETE ON event_rsvps
  FOR EACH ROW EXECUTE FUNCTION sync_rsvp_count();

-- ============================================================
-- ANNOUNCEMENTS + RESOURCES
-- ============================================================
CREATE TABLE IF NOT EXISTS announcements (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title      text NOT NULL,
  body       text NOT NULL,
  category   text NOT NULL DEFAULT 'news' CHECK (category IN ('news','academic','urgent')),
  pinned     boolean NOT NULL DEFAULT false,
  author_id  uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_read_all"    ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_admin_write" ON announcements FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE TABLE IF NOT EXISTS resources (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title       text NOT NULL,
  description text,
  file_url    text NOT NULL,
  course_code text,
  level       text,
  uploaded_by uuid NOT NULL REFERENCES profiles(id),
  downloads   int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "resources_read_all"    ON resources FOR SELECT USING (true);
CREATE POLICY "resources_admin_write" ON resources FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

-- ============================================================
-- CHANNELS + MESSAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS channels (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text NOT NULL,
  description text,
  type        text NOT NULL DEFAULT 'public' CHECK (type IN ('public','private','announcement')),
  created_by  uuid NOT NULL REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS channel_members (
  channel_id uuid REFERENCES channels(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role       text NOT NULL DEFAULT 'member',
  PRIMARY KEY (channel_id, user_id)
);

ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channels_read_members" ON channels FOR SELECT USING (
  type = 'public' OR
  EXISTS (SELECT 1 FROM channel_members WHERE channel_id = channels.id AND user_id = auth.uid())
);

ALTER TABLE channel_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "channel_members_read" ON channel_members FOR SELECT USING (
  user_id = auth.uid() OR
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);
CREATE POLICY "channel_members_join_public" ON channel_members FOR INSERT WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (SELECT 1 FROM channels WHERE id = channel_id AND type = 'public')
);

CREATE TABLE IF NOT EXISTS messages (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id  uuid REFERENCES channels(id) ON DELETE CASCADE,
  sender_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content     text NOT NULL,
  media_url   text,
  read_at     timestamptz,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "messages_read_own" ON messages FOR SELECT USING (
  sender_id = auth.uid() OR
  receiver_id = auth.uid() OR
  EXISTS (SELECT 1 FROM channel_members WHERE channel_id = messages.channel_id AND user_id = auth.uid())
);
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- COMPETITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS competitions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         text NOT NULL,
  description   text,
  type          text NOT NULL DEFAULT 'coding_challenge' CHECK (type IN ('hackathon','quiz','coding_challenge')),
  rules         text,
  prizes        text,
  status        text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming','active','ended')),
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  max_team_size int NOT NULL DEFAULT 1,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "competitions_read_all"    ON competitions FOR SELECT USING (true);
CREATE POLICY "competitions_admin_write" ON competitions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

CREATE TABLE IF NOT EXISTS competition_submissions (
  id             uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  competition_id uuid NOT NULL REFERENCES competitions(id) ON DELETE CASCADE,
  submitter_id   uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  team_name      text,
  repo_url       text,
  demo_url       text,
  description    text,
  score          int,
  rank           int,
  submitted_at   timestamptz DEFAULT now(),
  UNIQUE (competition_id, submitter_id)
);

ALTER TABLE competition_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "submissions_read_all"    ON competition_submissions FOR SELECT USING (true);
CREATE POLICY "submissions_insert_own"  ON competition_submissions FOR INSERT WITH CHECK (auth.uid() = submitter_id);
CREATE POLICY "submissions_admin_score" ON competition_submissions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       text NOT NULL,
  title      text NOT NULL,
  body       text NOT NULL,
  link       text,
  read       boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);

-- Notification trigger: new comment on post
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS trigger AS $$
DECLARE post_author uuid;
BEGIN
  SELECT author_id INTO post_author FROM posts WHERE id = NEW.post_id;
  IF post_author != NEW.author_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      post_author, 'comment',
      'New comment on your post',
      'Someone commented on your post',
      '/social/' || NEW.post_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_comment ON post_comments;
CREATE TRIGGER on_new_comment
  AFTER INSERT ON post_comments
  FOR EACH ROW EXECUTE FUNCTION notify_post_comment();

-- Notification trigger: new DM received
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger AS $$
BEGIN
  IF NEW.receiver_id IS NOT NULL AND NEW.receiver_id != NEW.sender_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.receiver_id, 'message',
      'New message',
      'You have a new direct message',
      '/chat/dm/' || NEW.sender_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_new_dm ON messages;
CREATE TRIGGER on_new_dm
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_new_message();

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_dm ON messages(sender_id, receiver_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_votes_election ON votes(election_id);
