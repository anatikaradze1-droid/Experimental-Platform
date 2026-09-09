-- Experimental Platform v2
-- Run in Supabase SQL Editor on a NEW project.

create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  stimulus_type text not null check (stimulus_type in ('circle','line','audio')),
  status text not null default 'draft' check (status in ('draft','published','archived')),
  version integer not null default 1,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.sessions (
  id uuid primary key,
  experiment_id uuid not null references public.experiments(id),
  experiment_version integer not null,
  participant_code text not null,
  device_type text,
  calibration_px_per_mm numeric,
  viewport_width integer,
  viewport_height integer,
  user_agent text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  validity_status text,
  summary jsonb not null default '{}'::jsonb
);

create table if not exists public.trials (
  id uuid primary key,
  experiment_id uuid not null references public.experiments(id),
  experiment_version integer not null,
  session_id uuid not null references public.sessions(id) on delete cascade,
  participant_code text not null,
  series text not null,
  global_trial integer,
  series_trial integer,
  stimulus_type text,
  left_value numeric,
  right_value numeric,
  response text,
  response_key text,
  rt_ms numeric,
  missing boolean not null default false,
  set_large_side text,
  asymmetry_side text,
  viewport_width integer,
  viewport_height integer,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;
alter table public.experiments enable row level security;
alter table public.sessions enable row level security;
alter table public.trials enable row level security;

-- Least-privilege grants.
revoke all on public.admin_users from anon, authenticated;
revoke all on public.experiments from anon, authenticated;
revoke all on public.sessions from anon, authenticated;
revoke all on public.trials from anon, authenticated;

grant select on public.experiments to anon;
grant select,insert,update,delete on public.experiments to authenticated;
grant insert on public.sessions to anon;
grant insert on public.trials to anon;
grant select,insert,update,delete on public.sessions to authenticated;
grant select,insert,update,delete on public.trials to authenticated;
grant select on public.admin_users to authenticated;

-- Helper: only IDs manually inserted in admin_users are admins.
create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admin_users a where a.user_id = auth.uid());
$$;

revoke all on function public.is_platform_admin() from public;
grant execute on function public.is_platform_admin() to authenticated;

-- Public participants may read only published experiment definitions.
create policy "published experiments are public"
on public.experiments for select to anon
using (status='published');

-- Admins can fully manage experiments and see all experiment versions.
create policy "admins select experiments"
on public.experiments for select to authenticated
using (public.is_platform_admin());

create policy "admins insert experiments"
on public.experiments for insert to authenticated
with check (public.is_platform_admin());

create policy "admins update experiments"
on public.experiments for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy "admins delete experiments"
on public.experiments for delete to authenticated
using (public.is_platform_admin());

-- Participant data: anonymous users can INSERT but cannot SELECT.
-- The experiment must exist and be published.
create policy "participants create sessions"
on public.sessions for insert to anon
with check (
  exists(select 1 from public.experiments e where e.id=experiment_id and e.status='published')
);

create policy "participants insert trials"
on public.trials for insert to anon
with check (
  exists(select 1 from public.experiments e where e.id=experiment_id and e.status='published')
);

-- Admin access to participant data.
create policy "admins select sessions"
on public.sessions for select to authenticated
using (public.is_platform_admin());
create policy "admins update sessions"
on public.sessions for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "admins delete sessions"
on public.sessions for delete to authenticated
using (public.is_platform_admin());

create policy "admins select trials"
on public.trials for select to authenticated
using (public.is_platform_admin());
create policy "admins update trials"
on public.trials for update to authenticated
using (public.is_platform_admin()) with check (public.is_platform_admin());
create policy "admins delete trials"
on public.trials for delete to authenticated
using (public.is_platform_admin());

-- Let an anonymous participant mark only an existing session as completed
-- through a narrow RPC. No general anonymous UPDATE grant is required.
create or replace function public.finish_participant_session(
  p_session_id uuid,
  p_completed_at timestamptz,
  p_summary jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.sessions
  set completed_at = p_completed_at,
      validity_status = coalesce(p_summary->>'validity_status', validity_status),
      summary = coalesce(p_summary, '{}'::jsonb)
  where id = p_session_id
    and completed_at is null;
end;
$$;

revoke all on function public.finish_participant_session(uuid,timestamptz,jsonb) from public;
grant execute on function public.finish_participant_session(uuid,timestamptz,jsonb) to anon, authenticated;

-- IMPORTANT HARDENING NOTE:
-- For production, add a per-session unguessable completion token to the RPC.
-- UUID session IDs are hard to guess, but a token makes the boundary explicit.

-- After creating your first Supabase Auth user, copy its UUID and run:
-- insert into public.admin_users(user_id) values ('YOUR-AUTH-USER-UUID');
