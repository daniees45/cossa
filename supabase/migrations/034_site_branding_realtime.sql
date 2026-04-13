-- Ensure global branding updates propagate through Supabase Realtime
-- to all connected clients/devices.
alter publication supabase_realtime add table public.site_branding;