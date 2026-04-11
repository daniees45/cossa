-- ============================================================
-- COSSA — Notification targeting + actor identity
-- 1) Include actor name in generated notifications
-- 2) Keep notifications targeted (not everyone)
-- ============================================================

-- Notification trigger: new comment on post (with actor name)
CREATE OR REPLACE FUNCTION notify_post_comment()
RETURNS trigger AS $$
DECLARE
  post_author uuid;
  commenter_name text;
BEGIN
  SELECT author_id INTO post_author FROM posts WHERE id = NEW.post_id;
  SELECT coalesce(full_name, username, 'Someone') INTO commenter_name
  FROM profiles
  WHERE id = NEW.author_id;

  IF post_author != NEW.author_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      post_author,
      'comment',
      'New comment from ' || coalesce(commenter_name, 'Someone'),
      coalesce(commenter_name, 'Someone') || ' commented on your post',
      '/'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notification trigger: new DM received (with actor name)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS trigger AS $$
DECLARE
  sender_name text;
BEGIN
  SELECT coalesce(full_name, username, 'Someone') INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  IF NEW.receiver_id IS NOT NULL AND NEW.receiver_id != NEW.sender_id THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    VALUES (
      NEW.receiver_id,
      'message',
      'New message from ' || coalesce(sender_name, 'Someone'),
      coalesce(sender_name, 'Someone') || ' sent you a direct message',
      '/chat/dm/' || NEW.sender_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: broadcast with sender identity in body.
CREATE OR REPLACE FUNCTION broadcast_notification(
  p_title  text,
  p_body   text,
  p_link   text    DEFAULT NULL,
  p_levels text[]  DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted_count integer;
  v_actor_name text;
BEGIN
  IF (SELECT role FROM profiles WHERE id = auth.uid()) NOT IN ('admin', 'super_admin') THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT coalesce(full_name, username, 'Admin') INTO v_actor_name
  FROM profiles
  WHERE id = auth.uid();

  IF p_levels IS NULL OR array_length(p_levels, 1) IS NULL THEN
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT id, 'broadcast', p_title, 'From ' || coalesce(v_actor_name, 'Admin') || ': ' || p_body, p_link
    FROM profiles;
  ELSE
    INSERT INTO notifications (user_id, type, title, body, link)
    SELECT id, 'broadcast', p_title, 'From ' || coalesce(v_actor_name, 'Admin') || ': ' || p_body, p_link
    FROM profiles
    WHERE level = ANY(p_levels);
  END IF;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$;
