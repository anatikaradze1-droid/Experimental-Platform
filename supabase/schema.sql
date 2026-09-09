-- CogExperiments Platform v2.1
-- Run in Supabase SQL Editor on a NEW project.
create extension if not exists pgcrypto;

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.experiments (
  id uuid primary key default gen_random_uuid(), slug text not null unique, name text not null,
  description text, status text not null default 'draft' check(status in ('draft','published','archived')),
  version integer not null default 1, config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.sessions (
  id uuid primary key, experiment_id uuid not null references public.experiments(id), experiment_version integer not null,
  participant_code text not null, device_type text, calibration_px_per_mm numeric, viewport_width integer, viewport_height integer,
  user_agent text, created_at timestamptz not null default now(), completed_at timestamptz, validity_status text,
  summary jsonb not null default '{}'::jsonb
);
create table if not exists public.trials (
  id uuid primary key, experiment_id uuid not null references public.experiments(id), experiment_version integer not null,
  session_id uuid not null references public.sessions(id) on delete cascade, participant_code text not null,
  series text not null, global_trial integer, series_trial integer, stimulus_type text, stimulus_1 text, stimulus_2 text,
  left_value numeric, right_value numeric, response text, response_key text, rt_ms numeric, missing boolean not null default false,
  set_large_side text, asymmetry_side text, viewport_width integer, viewport_height integer, created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security; alter table public.experiments enable row level security;
alter table public.sessions enable row level security; alter table public.trials enable row level security;

create or replace function public.is_platform_admin() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.admin_users a where a.user_id=auth.uid());
$$;
revoke all on function public.is_platform_admin() from public; grant execute on function public.is_platform_admin() to authenticated;

grant select on public.experiments to anon; grant select,insert,update,delete on public.experiments to authenticated;
grant insert on public.sessions to anon; grant insert on public.trials to anon;
grant select,insert,update,delete on public.sessions to authenticated; grant select,insert,update,delete on public.trials to authenticated;
grant select on public.admin_users to authenticated;

create policy "published experiments public" on public.experiments for select to anon using(status='published');
create policy "admins select experiments" on public.experiments for select to authenticated using(public.is_platform_admin());
create policy "admins insert experiments" on public.experiments for insert to authenticated with check(public.is_platform_admin());
create policy "admins update experiments" on public.experiments for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy "admins delete experiments" on public.experiments for delete to authenticated using(public.is_platform_admin());
create policy "participants create sessions" on public.sessions for insert to anon with check(exists(select 1 from public.experiments e where e.id=experiment_id and e.status='published'));
create policy "participants insert trials" on public.trials for insert to anon with check(exists(select 1 from public.experiments e where e.id=experiment_id and e.status='published'));
create policy "admins select sessions" on public.sessions for select to authenticated using(public.is_platform_admin());
create policy "admins update sessions" on public.sessions for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy "admins delete sessions" on public.sessions for delete to authenticated using(public.is_platform_admin());
create policy "admins select trials" on public.trials for select to authenticated using(public.is_platform_admin());
create policy "admins update trials" on public.trials for update to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
create policy "admins delete trials" on public.trials for delete to authenticated using(public.is_platform_admin());

create or replace function public.finish_participant_session(p_session_id uuid,p_completed_at timestamptz,p_summary jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin update public.sessions set completed_at=p_completed_at,validity_status=coalesce(p_summary->>'validity_status',validity_status),
summary=coalesce(p_summary,'{}'::jsonb) where id=p_session_id and completed_at is null; end; $$;
revoke all on function public.finish_participant_session(uuid,timestamptz,jsonb) from public;
grant execute on function public.finish_participant_session(uuid,timestamptz,jsonb) to anon,authenticated;

-- Stimulus file storage
insert into storage.buckets(id,name,public) values('stimuli','stimuli',true) on conflict(id) do update set public=true;
create policy "public read stimuli" on storage.objects for select to public using(bucket_id='stimuli');
create policy "admins upload stimuli" on storage.objects for insert to authenticated with check(bucket_id='stimuli' and public.is_platform_admin());
create policy "admins update stimuli" on storage.objects for update to authenticated using(bucket_id='stimuli' and public.is_platform_admin());
create policy "admins delete stimuli" on storage.objects for delete to authenticated using(bucket_id='stimuli' and public.is_platform_admin());

-- After registering your first account:
-- Supabase > Authentication > Users > copy User UID, then run:
-- insert into public.admin_users(user_id) values ('PASTE-USER-UUID-HERE');
