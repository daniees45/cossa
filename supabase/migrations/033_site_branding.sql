-- Global site branding configuration shared across all users/devices.
create table if not exists public.site_branding (
  id smallint primary key default 1 check (id = 1),
  site_title text not null default 'COSSA',
  site_subtitle text not null default 'VVU CS Assoc.',
  logo_url text not null default '',
  light_background text not null default '#f8fafc',
  dark_background text not null default '#020617',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.site_branding (id)
values (1)
on conflict (id) do nothing;

alter table public.site_branding enable row level security;

drop policy if exists site_branding_read on public.site_branding;
create policy site_branding_read
on public.site_branding
for select
to public
using (true);

drop policy if exists site_branding_admin_write on public.site_branding;
create policy site_branding_admin_write
on public.site_branding
for update
to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'super_admin')
  )
);
