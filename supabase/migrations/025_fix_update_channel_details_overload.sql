-- ============================================================
-- COSSA — Fix update_channel_details overload ambiguity
-- Ensures only one RPC signature exists for PostgREST resolution
-- ============================================================

-- Remove both legacy and newer overloaded signatures, then recreate one canonical function.
DROP FUNCTION IF EXISTS update_channel_details(uuid, text, text);
DROP FUNCTION IF EXISTS update_channel_details(uuid, text, text, text, text, text);
DROP FUNCTION IF EXISTS update_channel_details(uuid, text, text, text, text, text, text);

CREATE OR REPLACE FUNCTION update_channel_details(
  p_channel_id uuid,
  p_name text DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_emoji_icon text DEFAULT NULL,
  p_color_hex text DEFAULT NULL,
  p_banner_url text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_channel channels%ROWTYPE;
  v_name_slug text;
  v_allowed boolean := false;
  v_effective_color text;
BEGIN
  IF v_actor IS NULL THEN
    RETURN json_build_object('ok', false, 'error', 'Not authenticated.');
  END IF;

  SELECT * INTO v_channel FROM channels WHERE id = p_channel_id;
  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'Channel not found.');
  END IF;

  SELECT (
    v_channel.created_by = v_actor
    OR EXISTS (
      SELECT 1
      FROM channel_members cm
      WHERE cm.channel_id = p_channel_id
        AND cm.user_id = v_actor
        AND cm.role = 'admin'
    )
  ) INTO v_allowed;

  IF NOT COALESCE(v_allowed, false) THEN
    RETURN json_build_object('ok', false, 'error', 'Only channel admins can edit channel details.');
  END IF;

  v_name_slug := NULL;
  IF p_name IS NOT NULL THEN
    v_name_slug := regexp_replace(lower(trim(coalesce(p_name, ''))), '[^a-z0-9-]+', '-', 'g');
    v_name_slug := regexp_replace(v_name_slug, '(^-+|-+$)', '', 'g');
    IF v_name_slug = '' THEN
      RETURN json_build_object('ok', false, 'error', 'Channel name cannot be empty.');
    END IF;

    IF EXISTS (
      SELECT 1
      FROM channels c
      WHERE lower(c.name) = v_name_slug
        AND c.id <> p_channel_id
    ) THEN
      RETURN json_build_object('ok', false, 'error', 'A channel with this name already exists.');
    END IF;
  END IF;

  v_effective_color := COALESCE(NULLIF(trim(p_color_hex), ''), v_channel.color_hex, '#7c3aed');
  IF v_effective_color !~ '^#([A-Fa-f0-9]{6})$' THEN
    RETURN json_build_object('ok', false, 'error', 'Color must be a valid hex code like #7c3aed.');
  END IF;

  UPDATE channels
  SET
    name = COALESCE(v_name_slug, name),
    description = CASE
      WHEN p_description IS NULL THEN description
      ELSE nullif(trim(p_description), '')
    END,
    avatar_url = CASE
      WHEN p_avatar_url IS NULL THEN avatar_url
      ELSE nullif(trim(p_avatar_url), '')
    END,
    emoji_icon = CASE
      WHEN p_emoji_icon IS NULL THEN emoji_icon
      ELSE nullif(trim(p_emoji_icon), '')
    END,
    color_hex = v_effective_color,
    banner_url = CASE
      WHEN p_banner_url IS NULL THEN banner_url
      ELSE nullif(trim(p_banner_url), '')
    END
  WHERE id = p_channel_id;

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION update_channel_details(uuid, text, text, text, text, text, text) TO authenticated;
