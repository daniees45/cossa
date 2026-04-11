-- ============================================================
-- COSSA — Admin Setup & Storage Buckets
-- Run AFTER 001_initial_schema.sql
-- ============================================================

-- ============================================================
-- STEP 1: Promote the first registered user to super_admin
-- Replace 'your.email@example.com' with the actual email
-- ============================================================
UPDATE profiles
SET role = 'super_admin'
WHERE id = (
  SELECT id FROM auth.users
  WHERE email = 'your.email@example.com'
  LIMIT 1
);

-- ============================================================
-- STEP 2: Storage Buckets
-- Run each INSERT separately if any already exist
-- ============================================================

-- Avatars bucket (profile pictures)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars', 'avatars', true,
  2097152,  -- 2 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Posts media bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts', 'posts', true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
) ON CONFLICT (id) DO NOTHING;

-- Gallery bucket (entertainment page)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gallery', 'gallery', true,
  10485760,  -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Resources bucket (academic files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'resources', 'resources', true,
  52428800,  -- 50 MB
  ARRAY['application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/zip', 'text/plain']
) ON CONFLICT (id) DO NOTHING;

-- Event/competition cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'covers', 'covers', true,
  5242880,  -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3: Storage RLS Policies
-- Drop existing policies first so this script is re-runnable
-- ============================================================
DROP POLICY IF EXISTS "avatars_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_auth_upload"   ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_update"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_owner_delete"  ON storage.objects;
DROP POLICY IF EXISTS "posts_public_read"     ON storage.objects;
DROP POLICY IF EXISTS "posts_auth_upload"     ON storage.objects;
DROP POLICY IF EXISTS "posts_owner_delete"    ON storage.objects;
DROP POLICY IF EXISTS "gallery_public_read"   ON storage.objects;
DROP POLICY IF EXISTS "gallery_admin_upload"  ON storage.objects;
DROP POLICY IF EXISTS "resources_public_read" ON storage.objects;
DROP POLICY IF EXISTS "resources_admin_upload" ON storage.objects;
DROP POLICY IF EXISTS "covers_public_read"    ON storage.objects;
DROP POLICY IF EXISTS "covers_admin_upload"   ON storage.objects;

-- Avatars: anyone can read; owner can upload/update/delete
CREATE POLICY "avatars_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "avatars_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "avatars_owner_update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "avatars_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Posts: anyone can read; authenticated users can upload
CREATE POLICY "posts_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'posts');

CREATE POLICY "posts_auth_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

CREATE POLICY "posts_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Gallery: public read; admin upload
CREATE POLICY "gallery_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'gallery');

CREATE POLICY "gallery_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'gallery' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- Resources: public read; admin upload
CREATE POLICY "resources_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'resources');

CREATE POLICY "resources_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'resources' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- Covers: public read; admin upload
CREATE POLICY "covers_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'covers');

CREATE POLICY "covers_admin_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'covers' AND
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','super_admin'))
  );

-- ============================================================
-- STEP 4: Seed initial public channels
-- ============================================================
INSERT INTO channels (name, description, type, created_by)
SELECT
  chan.name,
  chan.description,
  'public',
  (SELECT id FROM profiles WHERE role = 'super_admin' LIMIT 1)
FROM (VALUES
  ('general',      'General discussion for all COSSA members'),
  ('announcements','Official announcements from COSSA executives'),
  ('tech-talk',    'Discuss programming languages, frameworks, and tools'),
  ('project-help', 'Get help with your projects and assignments'),
  ('memes',        'Relax and share CS memes')
) AS chan(name, description)
WHERE EXISTS (SELECT 1 FROM profiles WHERE role = 'super_admin')
ON CONFLICT DO NOTHING;
