-- ============================================================
-- COSSA — Feed/user-status and comment-tree RPCs
-- 1) Eliminate large client-side IN(...) status queries for feed items
-- 2) Build hierarchical comment trees in PostgreSQL
-- ============================================================

CREATE OR REPLACE FUNCTION get_feed_with_user_status(
  p_mode text DEFAULT 'all',
  p_page int DEFAULT 0,
  p_page_size int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  author_id uuid,
  content text,
  media_urls text[],
  type text,
  likes_count int,
  comments_count int,
  pinned boolean,
  created_at timestamptz,
  author jsonb,
  liked_by_me boolean,
  bookmarked_by_me boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_mode text := COALESCE(NULLIF(trim(lower(p_mode)), ''), 'all');
  v_from int := GREATEST(COALESCE(p_page, 0), 0) * GREATEST(COALESCE(p_page_size, 10), 1);
  v_to int := (GREATEST(COALESCE(p_page, 0), 0) * GREATEST(COALESCE(p_page_size, 10), 1))
              + GREATEST(COALESCE(p_page_size, 10), 1) - 1;
BEGIN
  IF v_mode NOT IN ('all', 'following', 'saved') THEN
    RETURN;
  END IF;

  IF v_mode = 'saved' THEN
    IF v_user_id IS NULL THEN
      RETURN;
    END IF;

    RETURN QUERY
    SELECT
      p.id,
      p.author_id,
      p.content,
      p.media_urls,
      p.type::text,
      p.likes_count,
      p.comments_count,
      p.pinned,
      p.created_at,
      to_jsonb(pr) AS author,
      EXISTS (
        SELECT 1
        FROM post_likes pl
        WHERE pl.post_id = p.id
          AND pl.user_id = v_user_id
      ) AS liked_by_me,
      true AS bookmarked_by_me
    FROM post_bookmarks pb
    JOIN posts p ON p.id = pb.post_id
    JOIN profiles pr ON pr.id = p.author_id
    WHERE pb.user_id = v_user_id
    ORDER BY pb.created_at DESC
    OFFSET v_from
    LIMIT (v_to - v_from + 1);

    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.author_id,
    p.content,
    p.media_urls,
    p.type::text,
    p.likes_count,
    p.comments_count,
    p.pinned,
    p.created_at,
    to_jsonb(pr) AS author,
    CASE
      WHEN v_user_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1
        FROM post_likes pl
        WHERE pl.post_id = p.id
          AND pl.user_id = v_user_id
      )
    END AS liked_by_me,
    CASE
      WHEN v_user_id IS NULL THEN false
      ELSE EXISTS (
        SELECT 1
        FROM post_bookmarks pb
        WHERE pb.post_id = p.id
          AND pb.user_id = v_user_id
      )
    END AS bookmarked_by_me
  FROM posts p
  JOIN profiles pr ON pr.id = p.author_id
  WHERE (
    v_mode = 'all'
    OR (
      v_mode = 'following'
      AND v_user_id IS NOT NULL
      AND (
        p.author_id = v_user_id
        OR EXISTS (
          SELECT 1
          FROM followers f
          WHERE f.follower_id = v_user_id
            AND f.following_id = p.author_id
        )
      )
    )
  )
  ORDER BY p.pinned DESC, p.created_at DESC
  OFFSET v_from
  LIMIT (v_to - v_from + 1);
END;
$$;

GRANT EXECUTE ON FUNCTION get_feed_with_user_status(text, int, int) TO authenticated;

CREATE OR REPLACE FUNCTION build_post_comment_node(
  p_comment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_comment record;
  v_replies jsonb;
BEGIN
  SELECT
    c.id,
    c.content,
    c.created_at,
    c.parent_id,
    jsonb_build_object(
      'username', p.username,
      'full_name', p.full_name,
      'avatar_url', p.avatar_url
    ) AS author
  INTO v_comment
  FROM post_comments c
  JOIN profiles p ON p.id = c.author_id
  WHERE c.id = p_comment_id;

  IF v_comment.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(
    jsonb_agg(build_post_comment_node(rc.id) ORDER BY rc.created_at ASC),
    '[]'::jsonb
  )
  INTO v_replies
  FROM post_comments rc
  WHERE rc.parent_id = p_comment_id;

  RETURN jsonb_build_object(
    'id', v_comment.id,
    'content', v_comment.content,
    'created_at', v_comment.created_at,
    'parent_id', v_comment.parent_id,
    'author', v_comment.author,
    'replies', v_replies
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_post_comments_tree(
  p_post_id uuid,
  p_limit int DEFAULT 50
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH roots AS (
    SELECT c.id, c.created_at
    FROM post_comments c
    WHERE c.post_id = p_post_id
      AND c.parent_id IS NULL
    ORDER BY c.created_at ASC
    LIMIT GREATEST(COALESCE(p_limit, 50), 1)
  )
  SELECT COALESCE(
    jsonb_agg(build_post_comment_node(r.id) ORDER BY r.created_at ASC),
    '[]'::jsonb
  )
  FROM roots r;
$$;

GRANT EXECUTE ON FUNCTION build_post_comment_node(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_post_comments_tree(uuid, int) TO authenticated;
