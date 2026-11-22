-- ShadowScope schema.
--
-- Idempotent and additive: safe on a fresh project AND on a database created from the
-- earlier schema. It never drops tables or data. Apply it by pasting into the Supabase
-- SQL editor, or with psql:  psql "$DATABASE_URL" -f supabase/schema.sql
--
-- Upgrade notes for databases created before backend v1:
--   * projects.owner_user_id is nullable so existing rows survive; rows without an owner are
--     invisible to every user. Assign them:  update projects set owner_user_id = '<user uuid>' where owner_user_id is null;
--   * findings.asset_id becomes nullable (dependency findings may have no deployed host).
--   * scans.status gains 'partial' and 'cancelled'.

create extension if not exists "pgcrypto";

-- Projects --------------------------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  root_domain text not null,
  api_docs text null,
  authorization_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint projects_root_domain_not_blank check (length(trim(root_domain)) > 0)
);
alter table projects add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;
alter table projects add column if not exists updated_at timestamptz not null default now();
alter table projects add column if not exists verification_token_hash text;
alter table projects add column if not exists verified_token_hash text;
alter table projects add column if not exists verification_expires_at timestamptz;
alter table projects add column if not exists verified_at timestamptz;
alter table projects add column if not exists verification_method text;
alter table projects add column if not exists api_docs text;  -- client API description (OpenAPI etc.)

-- Scans -----------------------------------------------------------------------------------
create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table scans add column if not exists created_by uuid references auth.users(id) on delete set null;
alter table scans add column if not exists error text;
alter table scans add column if not exists updated_at timestamptz not null default now();
alter table scans drop constraint if exists scans_status_check;
alter table scans add constraint scans_status_check
  check (status in ('queued', 'running', 'completed', 'partial', 'failed', 'cancelled'));

-- Assets ----------------------------------------------------------------------------------
create table if not exists assets (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  hostname text not null,
  ip_addresses text[] not null default '{}',
  technology text,
  https boolean not null default false,
  environment text not null check (environment in ('prod', 'staging', 'dev', 'unknown')),
  status text not null check (status in ('resolved', 'unresolved')),
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table assets add column if not exists environment_source text not null default 'heuristic';
alter table assets add column if not exists environment_confidence text not null default 'low';
alter table assets add column if not exists dns jsonb not null default '{}'::jsonb;
alter table assets add column if not exists http jsonb not null default '{}'::jsonb;
alter table assets add column if not exists tls jsonb not null default '{}'::jsonb;
create unique index if not exists uq_assets_scan_hostname on assets(scan_id, hostname);

-- Evidence: every raw observation a finding can point at ---------------------------------
create table if not exists evidence (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  asset_id uuid references assets(id) on delete cascade,
  kind text not null check (kind in ('ct', 'dns', 'http', 'tls', 'manifest', 'osv')),
  source text not null,
  data jsonb not null default '{}'::jsonb,
  collected_at timestamptz not null default now()
);

-- Dependencies ----------------------------------------------------------------------------
create table if not exists dependencies (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  package_name text not null,
  version text not null,
  ecosystem text not null,
  direct boolean not null default false,
  advisories jsonb not null default '[]'::jsonb,
  fixed_version text,
  created_at timestamptz not null default now()
);
alter table dependencies add column if not exists resolved boolean not null default true;
alter table dependencies add column if not exists manifest_name text;
alter table dependencies add column if not exists deployed_on text;  -- hostname the manifest ships on
alter table dependencies add column if not exists asset_id uuid references assets(id) on delete set null;

-- Findings --------------------------------------------------------------------------------
create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  asset_id uuid references assets(id) on delete cascade,
  type text not null,
  title text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  evidence text not null,
  remediation text not null,
  source text not null check (source in ('rules', 'osv')),
  "references" text[] not null default '{}',
  created_at timestamptz not null default now()
);
alter table findings alter column asset_id drop not null;
alter table findings add column if not exists rule_id text;
alter table findings add column if not exists description text;
alter table findings add column if not exists confidence text not null default 'medium';
alter table findings add column if not exists evidence_ids uuid[] not null default '{}';
alter table findings add column if not exists dependency_id uuid references dependencies(id) on delete set null;
alter table findings add column if not exists advisory_id text;

-- Scan log --------------------------------------------------------------------------------
create table if not exists scan_events (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  timestamp timestamptz not null default now(),
  level text not null check (level in ('info', 'warn', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);

-- Reports ---------------------------------------------------------------------------------
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  markdown text not null,
  created_at timestamptz not null default now(),
  unique (scan_id)
);
alter table reports add column if not exists generated_at timestamptz not null default now();

-- AI analyses (also the analysis job queue) ----------------------------------------------
create table if not exists analyses (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  source text check (source in ('gemini', 'fallback')),
  model text,
  prompt_version text,
  result jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  error text,
  requested_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------------------------
create index if not exists idx_projects_owner on projects(owner_user_id);
create index if not exists idx_scans_project_id on scans(project_id);
create index if not exists idx_scans_status on scans(status);
create index if not exists idx_assets_scan_id on assets(scan_id);
create index if not exists idx_evidence_scan_id on evidence(scan_id);
create index if not exists idx_findings_scan_id on findings(scan_id);
create index if not exists idx_findings_asset_id on findings(asset_id);
create index if not exists idx_dependencies_project_id on dependencies(project_id);
create index if not exists idx_scan_events_scan_id on scan_events(scan_id);
create index if not exists idx_reports_scan_id on reports(scan_id);
create index if not exists idx_analyses_scan_id on analyses(scan_id);
create index if not exists idx_analyses_status on analyses(status);

-- Row Level Security ----------------------------------------------------------------------
-- Defense in depth for any client using the anon key or a user JWT directly. The API uses
-- the service role (which bypasses RLS) and enforces the same ownership in code.
alter table projects enable row level security;
alter table scans enable row level security;
alter table assets enable row level security;
alter table evidence enable row level security;
alter table dependencies enable row level security;
alter table findings enable row level security;
alter table scan_events enable row level security;
alter table reports enable row level security;
alter table analyses enable row level security;

drop policy if exists projects_owner on projects;
create policy projects_owner on projects
  for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

drop policy if exists dependencies_owner on dependencies;
create policy dependencies_owner on dependencies
  for select using (exists (select 1 from projects p where p.id = project_id and p.owner_user_id = auth.uid()));

drop policy if exists scans_owner on scans;
create policy scans_owner on scans
  for select using (exists (select 1 from projects p where p.id = project_id and p.owner_user_id = auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['assets', 'evidence', 'findings', 'scan_events', 'reports', 'analyses'] loop
    execute format('drop policy if exists %I_owner on %I', t, t);
    execute format(
      'create policy %I_owner on %I for select using (exists (
         select 1 from scans s join projects p on p.id = s.project_id
         where s.id = scan_id and p.owner_user_id = auth.uid()))', t, t);
  end loop;
end $$;

-- Privileges -------------------------------------------------------------------------------
-- Newer Supabase projects don't auto-grant tables created in SQL to the API roles.
-- service_role: the backend (full access; it enforces ownership itself).
-- authenticated: read-only, and RLS above limits it to the user's own rows. anon: nothing.
grant usage on schema public to service_role, authenticated;
grant select, insert, update, delete on
  projects, scans, assets, evidence, dependencies, findings, scan_events, reports, analyses
  to service_role;
grant select on
  projects, scans, assets, evidence, dependencies, findings, scan_events, reports, analyses
  to authenticated;
revoke all on
  projects, scans, assets, evidence, dependencies, findings, scan_events, reports, analyses
  from anon;

-- Admin portal -----------------------------------------------------------------------------
-- See ADMIN-PANEL.md. The backend reaches these with the service role and enforces every check
-- itself. RLS is on with no policies and the browser roles have no grants, so anon and
-- authenticated can't read or write any of them.

create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('viewer', 'operator')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists user_status (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'pending_review', 'suspended')),
  risk_level text not null default 'low' check (risk_level in ('low', 'medium', 'high')),
  risk_reasons jsonb not null default '[]',
  signup_ip inet,
  status_reason text,
  updated_at timestamptz not null default now()
);

-- Domain claim review state. 'none' = not routed yet and NOT scan-eligible; only 'auto_cleared'
-- and 'approved' are. DNS proof stays in verified_at.
alter table projects add column if not exists review_status text not null default 'none';
alter table projects drop constraint if exists projects_review_status_check;
alter table projects add constraint projects_review_status_check
  check (review_status in ('none', 'auto_cleared', 'pending_review', 'approved', 'rejected'));
alter table projects add column if not exists risk_level text;
alter table projects add column if not exists risk_reasons jsonb not null default '[]';
alter table projects add column if not exists authorization_revoked_at timestamptz;
alter table projects add column if not exists revoked_reason text;

create table if not exists review_items (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('user', 'domain')),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references projects(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  risk_level text not null check (risk_level in ('medium', 'high')),
  signals jsonb not null,
  ai_verdict jsonb,
  decided_by uuid references auth.users(id) on delete set null,
  decided_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now(),
  constraint review_items_target check ((kind = 'domain') = (project_id is not null))
);
alter table review_items add column if not exists analysis_requested_at timestamptz not null default now();
alter table review_items add column if not exists analysis_started_at timestamptz;
alter table review_items add column if not exists analysis_finished_at timestamptz;
create index if not exists review_items_queue on review_items (status, created_at);
create unique index if not exists review_items_one_pending
  on review_items (kind, coalesce(project_id, user_id)) where status = 'pending';

create table if not exists security_events (
  id bigserial primary key,
  type text not null,
  user_id uuid references auth.users(id) on delete set null,
  ip text,
  subject text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists security_events_recent on security_events (created_at desc);
create index if not exists security_events_user on security_events (user_id, created_at desc);

create table if not exists domain_blocklist (
  pattern text primary key,
  match text not null check (match in ('exact', 'suffix')),
  reason text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Append-only. actor_id has no foreign key on purpose: audit rows must outlive the accounts they
-- name, and an ON DELETE action would be an UPDATE the trigger refuses. null = system/migration.
create table if not exists admin_audit_log (
  id bigserial primary key,
  actor_id uuid,
  action text not null,
  target_type text not null,
  target_id text not null,
  reason text,
  detail jsonb not null default '{}',
  ip text,
  created_at timestamptz not null default now()
);
create or replace function admin_audit_log_immutable() returns trigger language plpgsql as $$
begin
  raise exception 'admin_audit_log is append-only';
end $$;
drop trigger if exists admin_audit_log_no_change on admin_audit_log;
create trigger admin_audit_log_no_change before update or delete on admin_audit_log
  for each row execute function admin_audit_log_immutable();

-- Supabase Auth bans to apply, written in the same transaction as the suspension. The worker
-- applies them and retries, so the database and Auth can't silently diverge.
create table if not exists auth_outbox (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('ban', 'unban')),
  status text not null default 'pending' check (status in ('pending', 'done', 'failed')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  done_at timestamptz
);
alter table auth_outbox add column if not exists next_attempt_at timestamptz not null default now();
create index if not exists auth_outbox_pending on auth_outbox (status, next_attempt_at);

create table if not exists ai_admin_runs (
  id uuid primary key default gen_random_uuid(),
  review_item_id uuid references review_items(id) on delete set null,
  admin_user_id uuid references auth.users(id) on delete set null,
  purpose text not null check (purpose in ('review', 'copilot', 'daily_brief')),
  model_name text,
  prompt_version text,
  input_hash text,
  output_validation_status text,
  fallback_used boolean not null default false,
  error_category text,
  input_tokens int,
  output_tokens int,
  estimated_cost numeric(12, 6),
  latency_ms int,
  created_at timestamptz not null default now()
);

create table if not exists worker_health (
  singleton boolean primary key default true check (singleton),
  last_seen timestamptz not null
);
alter table worker_health enable row level security;
revoke all on worker_health from public, anon, authenticated;
grant select, insert, update on worker_health to service_role;

-- Every new account gets a status row, however it was created (API, dashboard, invite).
-- security definer: the Auth service inserts into auth.users with a role that has no rights here.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  needs_assessment boolean := coalesce(to_jsonb(new)->'raw_user_meta_data'->'shadowscope_assess_signup' = 'true'::jsonb, false);
begin
  insert into public.user_status (user_id, status, risk_level, status_reason)
  values (new.id, case when needs_assessment then 'pending_review' else 'active' end, 'low',
          case when needs_assessment then 'signup_unassessed' else 'signup' end)
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_auth_user();

-- Suspend or restore an account: status, outbox, and audit row in one transaction.
-- Errors, raised as the message text: reason_too_short, invalid_status, self_action,
-- not_operator, not_found.
create or replace function admin_set_user_status(
  p_actor uuid, p_target uuid, p_status text, p_reason text, p_ip text
) returns jsonb language plpgsql set search_path = public as $$
declare
  v_prev text;
begin
  if p_reason is null or length(btrim(p_reason)) < 5 then raise exception 'reason_too_short'; end if;
  if length(btrim(p_reason)) > 500 then raise exception 'invalid_reason'; end if;
  if p_status is null or p_status not in ('active', 'suspended') then raise exception 'invalid_status'; end if;
  if p_actor = p_target then raise exception 'self_action'; end if;
  if not exists (select 1 from admin_users where user_id = p_actor and role = 'operator') then
    raise exception 'not_operator';
  end if;
  -- Match the lock order of admin_decide_review when an operator changes a pending account directly.
  perform id from review_items where kind = 'user' and user_id = p_target and status = 'pending' for update;
  select status into v_prev from user_status where user_id = p_target for update;
  if not found then raise exception 'not_found'; end if;

  update user_status set status = p_status, status_reason = btrim(p_reason), updated_at = now()
  where user_id = p_target;
  if v_prev = 'pending_review' then
    update review_items
    set status = case when p_status = 'suspended' then 'rejected' else 'approved' end,
        decided_by = p_actor, decided_at = now(), decision_reason = btrim(p_reason)
    where kind = 'user' and user_id = p_target and status = 'pending';
  end if;
  if p_status = 'suspended' then
    update scans set status = 'cancelled', error = 'Account suspended.', completed_at = now(), updated_at = now()
    where status in ('queued', 'running') and project_id in (select id from projects where owner_user_id = p_target);
  end if;
  if v_prev is distinct from p_status then
    insert into auth_outbox (user_id, action)
    values (p_target, case when p_status = 'suspended' then 'ban' else 'unban' end);
  end if;
  insert into admin_audit_log (actor_id, action, target_type, target_id, reason, detail, ip)
  values (p_actor, case when p_status = 'suspended' then 'user.suspend' else 'user.unsuspend' end,
          'user', p_target::text, btrim(p_reason), jsonb_build_object('from', v_prev, 'to', p_status), p_ip);
  return jsonb_build_object('user_id', p_target, 'status', p_status, 'previous_status', v_prev);
end $$;

-- Backfill for databases created before the portal. Idempotent; returns the projects approved.
create or replace function admin_backfill() returns int language plpgsql set search_path = public as $$
declare
  n int;
begin
  insert into user_status (user_id, status, risk_level, status_reason)
  select id, 'active', 'low', 'migration backfill' from auth.users
  on conflict (user_id) do nothing;

  with upd as (
    update projects set review_status = 'approved'
    where review_status = 'none' and verified_at is not null and verification_method = 'dns-txt'
    returning id
  )
  insert into admin_audit_log (actor_id, action, target_type, target_id, reason)
  select null, 'migration.approve_legacy_dns', 'project', id::text, 'pre-portal DNS verification' from upd;
  get diagnostics n = row_count;
  return n;
end $$;
select admin_backfill();

alter table admin_users enable row level security;
alter table user_status enable row level security;
alter table review_items enable row level security;
alter table security_events enable row level security;
alter table domain_blocklist enable row level security;
alter table admin_audit_log enable row level security;
alter table auth_outbox enable row level security;
alter table ai_admin_runs enable row level security;

grant select, insert, update, delete on
  admin_users, user_status, review_items, security_events, domain_blocklist, auth_outbox, ai_admin_runs
  to service_role;
grant select, insert on admin_audit_log to service_role;
grant usage, select on sequence security_events_id_seq, admin_audit_log_id_seq, auth_outbox_id_seq
  to service_role;
revoke all on
  admin_users, user_status, review_items, security_events, domain_blocklist, admin_audit_log,
  auth_outbox, ai_admin_runs
  from anon, authenticated;

revoke execute on function admin_set_user_status(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke execute on function admin_backfill() from public, anon, authenticated;
revoke execute on function handle_new_auth_user() from public, anon, authenticated;
grant execute on function admin_set_user_status(uuid, uuid, text, text, text) to service_role;
grant execute on function admin_backfill() to service_role;

-- Admin read models. Only the backend service role can call these functions. The
-- directory and feeds join auth.users without exposing that schema through PostgREST.
begin;

create or replace function admin_list_users(
  p_q text, p_status text, p_risk text, p_limit int, p_after_at timestamptz, p_after_id uuid
) returns table (
  id uuid, email text, status text, risk_level text, risk_reasons jsonb,
  created_at timestamptz, last_seen timestamptz, projects bigint
) language sql stable security definer set search_path = '' as $$
  with directory as (
    select a.id, a.email::text, s.status, s.risk_level, s.risk_reasons,
           coalesce(a.created_at, 'epoch'::timestamptz) as created_at, a.last_sign_in_at as last_seen
    from auth.users a
    join public.user_status s on s.user_id = a.id
    where (p_q is null or strpos(lower(a.email), lower(p_q)) > 0)
      and (p_status is null or s.status = p_status)
      and (p_risk is null or s.risk_level = p_risk)
      and (p_after_at is null or (coalesce(a.created_at, 'epoch'::timestamptz), a.id) < (p_after_at, p_after_id))
    order by created_at desc, a.id desc
    limit least(greatest(p_limit, 1), 101)
  )
  select d.*, (select count(*) from public.projects p where p.owner_user_id = d.id)
  from directory d
  order by d.created_at desc, d.id desc;
$$;

create or replace function admin_list_events(p_type text, p_limit int, p_after_id bigint)
returns table (
  id bigint, type text, user_id uuid, user_email text, ip text,
  subject text, detail jsonb, created_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select e.id, e.type, e.user_id, a.email::text, e.ip, e.subject, e.detail, e.created_at
  from public.security_events e
  left join auth.users a on a.id = e.user_id
  where (p_type is null or e.type = p_type)
    and (p_after_id is null or e.id < p_after_id)
  order by e.id desc
  limit least(greatest(p_limit, 1), 101);
$$;

create or replace function admin_list_audit(p_action text, p_limit int, p_after_id bigint)
returns table (
  id bigint, actor_id uuid, actor_email text, action text, target_type text,
  target_id text, reason text, created_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select l.id, l.actor_id, a.email::text, l.action, l.target_type, l.target_id, l.reason, l.created_at
  from public.admin_audit_log l
  left join auth.users a on a.id = l.actor_id
  where (p_action is null or starts_with(l.action, p_action))
    and (p_after_id is null or l.id < p_after_id)
  order by l.id desc
  limit least(greatest(p_limit, 1), 101);
$$;

create or replace function admin_overview_counts(p_verified_since timestamptz)
returns table (
  users bigint, verified_domains bigint, pending_reviews bigint, scans_24h bigint,
  scan_failures_24h bigint, blocklist_hits_24h bigint, ai_fallback_rate double precision
) language sql stable set search_path = '' as $$
  select
    (select count(*) from public.user_status),
    (select count(*) from public.projects where verified_at > p_verified_since),
    (select count(*) from public.review_items where status = 'pending'),
    (select count(*) from public.scans where created_at >= now() - interval '24 hours'),
    (select count(*) from public.scans where status = 'failed' and updated_at >= now() - interval '24 hours'),
    (select count(*) from public.security_events where type = 'blocklist_hit' and created_at >= now() - interval '24 hours'),
    (select avg(fallback_used::int)::double precision from public.ai_admin_runs where created_at >= now() - interval '24 hours');
$$;

revoke execute on function
  admin_list_users(text, text, text, int, timestamptz, uuid),
  admin_list_events(text, int, bigint),
  admin_list_audit(text, int, bigint),
  admin_overview_counts(timestamptz)
  from public, anon, authenticated;
grant execute on function
  admin_list_users(text, text, text, int, timestamptz, uuid),
  admin_list_events(text, int, bigint),
  admin_list_audit(text, int, bigint),
  admin_overview_counts(timestamptz)
  to service_role;

commit;

-- Authorization and review state changes share a transaction with their review or audit row.
begin;

create or replace function route_signup(p_user uuid, p_ip inet, p_signals jsonb)
returns boolean language plpgsql set search_path = public as $$
begin
  update user_status set signup_ip = p_ip,
    status = case when jsonb_array_length(p_signals) > 0 then 'pending_review' else 'active' end,
    risk_level = case when jsonb_array_length(p_signals) > 0 then 'medium' else 'low' end,
    risk_reasons = (select coalesce(jsonb_agg(substr(value->>'id', 8)), '[]') from jsonb_array_elements(p_signals)),
    status_reason = 'signup assessed', updated_at = now()
  where user_id = p_user and status_reason in ('signup', 'signup_unassessed') and status in ('active', 'pending_review');
  if not found then return false; end if;
  if jsonb_array_length(p_signals) > 0 then
    insert into review_items(kind, user_id, risk_level, signals) values ('user', p_user, 'medium', p_signals);
    return true;
  end if;
  return false;
end $$;

create or replace function record_domain_proof(p_project uuid, p_hash text, p_level text, p_signals jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  p projects%rowtype;
  queued boolean := false;
begin
  select * into p from projects where id = p_project for update;
  if not found or p.verification_token_hash is distinct from p_hash or p_hash is null
     or p.verification_expires_at is null or p.verification_expires_at <= now() then
    raise exception 'challenge_changed';
  end if;
  if p.authorization_revoked_at is not null then raise exception 'revoked'; end if;
  if exists (select 1 from domain_blocklist b where b.pattern = p.root_domain
          or (b.match = 'suffix' and right(p.root_domain, length(b.pattern) + 1) = '.' || b.pattern)) then
    raise exception 'domain_blocked';
  end if;
  if p.review_status in ('none', 'auto_cleared') then
    p.review_status := case when p_level = 'low' then 'auto_cleared' else 'pending_review' end;
    if p.review_status = 'pending_review' then
      insert into review_items(kind, user_id, project_id, risk_level, signals)
      values ('domain', p.owner_user_id, p_project, p_level, p_signals) on conflict do nothing;
      queued := found;
    end if;
  end if;
  update projects set verified_at = now(), verification_method = 'dns-txt', verified_token_hash = p_hash,
    verification_token_hash = null, verification_expires_at = null, updated_at = now(),
    review_status = p.review_status, risk_level = p_level,
    risk_reasons = (select coalesce(jsonb_agg(substr(value->>'id', 8)), '[]') from jsonb_array_elements(p_signals))
  where id = p_project returning * into p;
  return jsonb_build_object('review_status', p.review_status, 'verified_at', p.verified_at, 'queued', queued);
end $$;

create or replace function admin_decide_review(p_id uuid, p_actor uuid, p_decision text, p_reason text, p_ip text)
returns uuid language plpgsql set search_path = public as $$
declare
  item review_items%rowtype;
  result text;
  account_status text;
begin
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'invalid_reason'; end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then raise exception 'invalid_decision'; end if;
  if not exists (select 1 from admin_users where user_id = p_actor and role = 'operator') then raise exception 'not_operator'; end if;
  select * into item from review_items where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if item.user_id = p_actor then raise exception 'self_action'; end if;
  if item.status <> 'pending' then raise exception 'already_decided'; end if;

  result := case when p_decision = 'approve' then 'approved' else 'rejected' end;
  if item.kind = 'domain' then
    update projects set review_status = result, updated_at = now()
    where id = item.project_id and owner_user_id = item.user_id and review_status = 'pending_review'
      and authorization_revoked_at is null;
    if not found then raise exception 'review_target_changed'; end if;
  else
    account_status := case when p_decision = 'approve' then 'active' else 'suspended' end;
    update user_status set status = account_status, status_reason = btrim(p_reason), updated_at = now()
    where user_id = item.user_id and status = 'pending_review';
    if not found then raise exception 'review_target_changed'; end if;
    if account_status = 'suspended' then
      insert into auth_outbox (user_id, action) values (item.user_id, 'ban');
      update scans set status = 'cancelled', error = 'Account suspended.', completed_at = now(), updated_at = now()
      where status in ('queued', 'running') and project_id in (select id from projects where owner_user_id = item.user_id);
    end if;
  end if;
  update review_items set status = result, decided_by = p_actor, decided_at = now(), decision_reason = btrim(p_reason) where id = p_id;
  insert into admin_audit_log(actor_id, action, target_type, target_id, reason, detail, ip)
  values (p_actor, 'review.' || p_decision, case when item.kind = 'domain' then 'project' else 'user' end,
          coalesce(item.project_id, item.user_id)::text, btrim(p_reason), jsonb_build_object('review_id', p_id), p_ip);
  return p_id;
end $$;

create or replace function admin_revoke_domain(p_project uuid, p_actor uuid, p_reason text, p_ip text)
returns uuid language plpgsql set search_path = public as $$
begin
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'invalid_reason'; end if;
  if not exists (select 1 from admin_users where user_id = p_actor and role = 'operator') then raise exception 'not_operator'; end if;
  update projects set authorization_revoked_at = now(), revoked_reason = btrim(p_reason), updated_at = now()
  where id = p_project and review_status in ('auto_cleared', 'approved') and authorization_revoked_at is null;
  if not found then raise exception 'review_target_changed'; end if;
  update scans set status = 'cancelled', error = 'Domain authorization revoked.', completed_at = now(), updated_at = now()
  where project_id = p_project and status in ('queued', 'running');
  insert into admin_audit_log(actor_id, action, target_type, target_id, reason, ip)
  values (p_actor, 'domain.revoke', 'project', p_project::text, btrim(p_reason), p_ip);
  return p_project;
end $$;

create or replace function admin_blocklist_change(p_pattern text, p_match text, p_actor uuid, p_reason text, p_ip text)
returns jsonb language plpgsql set search_path = public as $$
declare
  entry domain_blocklist%rowtype;
  action_name text;
begin
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'invalid_reason'; end if;
  if not exists (select 1 from admin_users where user_id = p_actor and role = 'operator') then raise exception 'not_operator'; end if;
  if p_match is null then
    delete from domain_blocklist where pattern = p_pattern returning * into entry;
    if not found then raise exception 'not_found'; end if;
    action_name := 'blocklist.remove';
  else
    insert into domain_blocklist(pattern, match, reason, created_by)
    values (p_pattern, p_match, btrim(p_reason), p_actor) on conflict do nothing returning * into entry;
    if not found then raise exception 'duplicate_pattern'; end if;
    action_name := 'blocklist.add';
    update scans set status = 'cancelled', error = 'Domain blocked by platform policy.', completed_at = now(), updated_at = now()
    where status in ('queued', 'running') and project_id in (
      select id from projects where root_domain = p_pattern
        or (p_match = 'suffix' and right(root_domain, length(p_pattern) + 1) = '.' || p_pattern)
    );
  end if;
  insert into admin_audit_log(actor_id, action, target_type, target_id, reason, detail, ip)
  values (p_actor, action_name, 'blocklist', p_pattern, btrim(p_reason), jsonb_build_object('match', entry.match), p_ip);
  return to_jsonb(entry);
end $$;

create or replace function queue_authorized_scan(p_project uuid, p_user uuid)
returns uuid language plpgsql set search_path = public as $$
declare
  p projects%rowtype;
  account_status text;
  scan_id uuid;
begin
  select status into account_status from user_status where user_id = p_user for update;
  if account_status is distinct from 'active' then raise exception 'scan_denied'; end if;
  select * into p from projects where id = p_project and owner_user_id = p_user for update;
  if not found or p.authorization_revoked_at is not null or p.review_status not in ('approved', 'auto_cleared')
     or p.verified_at is null or p.verified_at <= now() - interval '2160 hours'
     or p.verification_method is distinct from 'dns-txt' then
    raise exception 'scan_denied';
  end if;
  if exists (select 1 from domain_blocklist b where b.pattern = p.root_domain
          or (b.match = 'suffix' and right(p.root_domain, length(b.pattern) + 1) = '.' || b.pattern)) then
    raise exception 'scan_denied';
  end if;
  if exists (select 1 from scans where project_id = p_project and status in ('queued', 'running')) then
    raise exception 'scan_active';
  end if;
  insert into scans(project_id, created_by, status) values (p_project, p_user, 'queued') returning id into scan_id;
  return scan_id;
end $$;

revoke execute on function route_signup(uuid, inet, jsonb), record_domain_proof(uuid, text, text, jsonb),
  admin_decide_review(uuid, uuid, text, text, text), admin_revoke_domain(uuid, uuid, text, text),
  admin_blocklist_change(text, text, uuid, text, text), queue_authorized_scan(uuid, uuid) from public, anon, authenticated;
grant execute on function route_signup(uuid, inet, jsonb), record_domain_proof(uuid, text, text, jsonb),
  admin_decide_review(uuid, uuid, text, text, text), admin_revoke_domain(uuid, uuid, text, text),
  admin_blocklist_change(text, text, uuid, text, text), queue_authorized_scan(uuid, uuid) to service_role;

create or replace view admin_review_rows as
select r.id, r.kind, r.status, r.risk_level, r.user_id, a.email::text as user_email, r.project_id,
       p.root_domain, r.signals, r.ai_verdict, r.created_at, r.decided_by, r.decided_at, r.decision_reason
from review_items r join auth.users a on a.id = r.user_id
left join projects p on p.id = r.project_id;

create or replace view admin_domain_rows as
select p.id as project_id, p.root_domain, p.owner_user_id as owner_id, a.email::text as owner_email,
       case when p.verified_at is not null then
              case when p.verified_at > now() - interval '2160 hours' then 'verified' else 'expired' end
            when p.verification_token_hash is not null and p.verification_expires_at > now() then 'pending'
            else 'unverified' end as dns_proof,
       case when p.authorization_revoked_at is not null then 'revoked'
            when p.review_status = 'none' then 'not_routed' else p.review_status end as authorization,
       p.verified_at, p.risk_level
from projects p left join auth.users a on a.id = p.owner_user_id;

create or replace function admin_list_reviews(p_status text, p_kind text, p_limit int, p_after uuid)
returns setof admin_review_rows language sql stable set search_path = public as $$
  select r.* from admin_review_rows r
  where (p_status is null or r.status = p_status or (p_status = 'decided' and r.status <> 'pending'))
    and (p_kind is null or r.kind = p_kind)
    and (p_after is null or (r.risk_level, r.created_at, r.id) >
      (select c.risk_level, c.created_at, c.id from admin_review_rows c where c.id = p_after))
  order by r.risk_level, r.created_at, r.id limit least(greatest(p_limit, 1), 101);
$$;

create or replace function admin_user_profile(p_user uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', a.id, 'email', a.email, 'status', s.status, 'risk_level', s.risk_level,
     'risk_reasons', s.risk_reasons, 'created_at', coalesce(a.created_at, 'epoch'::timestamptz), 'last_seen', a.last_sign_in_at,
     'projects', (select count(*) from public.projects p where p.owner_user_id = a.id))
  from auth.users a join public.user_status s on s.user_id = a.id where a.id = p_user;
$$;

revoke all on admin_review_rows, admin_domain_rows from public, anon, authenticated;
grant select on admin_review_rows, admin_domain_rows to service_role;
revoke execute on function admin_list_reviews(text, text, int, uuid), admin_user_profile(uuid)
  from public, anon, authenticated;
grant execute on function admin_list_reviews(text, text, int, uuid), admin_user_profile(uuid) to service_role;

create or replace function admin_requeue_review(p_id uuid, p_actor uuid, p_reason text, p_ip text)
returns void language plpgsql set search_path = public as $$
begin
  if p_reason is null or length(btrim(p_reason)) not between 5 and 500 then raise exception 'invalid_reason'; end if;
  if not exists (select 1 from admin_users where user_id = p_actor and role = 'operator') then raise exception 'not_operator'; end if;
  update review_items set analysis_requested_at = now(), analysis_started_at = null, analysis_finished_at = null
  where id = p_id and status = 'pending' and user_id <> p_actor;
  if not found then raise exception 'review_target_changed'; end if;
  insert into admin_audit_log(actor_id, action, target_type, target_id, reason, ip)
  values (p_actor, 'review.reanalyze', 'review', p_id::text, btrim(p_reason), p_ip);
end $$;

create or replace function claim_admin_review()
returns setof review_items language sql set search_path = public as $$
  update review_items set analysis_started_at = now()
  where id = (
    select id from review_items where status = 'pending' and analysis_finished_at is null
      and (analysis_started_at is null or analysis_started_at < now() - interval '10 minutes')
    order by analysis_requested_at, id limit 1 for update skip locked
  ) returning *;
$$;

create or replace function finish_admin_review(p_id uuid, p_claimed_at timestamptz, p_verdict jsonb, p_run jsonb)
returns boolean language plpgsql set search_path = public as $$
begin
  insert into ai_admin_runs(review_item_id, purpose, model_name, prompt_version, input_hash,
    output_validation_status, fallback_used, error_category, input_tokens, output_tokens, latency_ms)
  values ((select id from review_items where id = p_id), 'review', p_run->>'model_name', p_run->>'prompt_version',
    p_run->>'input_hash', p_run->>'output_validation_status', (p_run->>'fallback_used')::boolean,
    p_run->>'error_category', (p_run->>'input_tokens')::int, (p_run->>'output_tokens')::int, (p_run->>'latency_ms')::int);
  update review_items set ai_verdict = p_verdict, analysis_finished_at = now()
    where id = p_id and status = 'pending' and analysis_started_at = p_claimed_at and analysis_finished_at is null;
  return found;
end $$;

revoke execute on function admin_requeue_review(uuid, uuid, text, text), claim_admin_review(),
  finish_admin_review(uuid, timestamptz, jsonb, jsonb) from public, anon, authenticated;
grant execute on function admin_requeue_review(uuid, uuid, text, text), claim_admin_review(),
  finish_admin_review(uuid, timestamptz, jsonb, jsonb) to service_role;

create index if not exists ai_admin_runs_recent on ai_admin_runs (created_at desc);
create index if not exists review_items_analysis_queue on review_items (analysis_requested_at)
  where status = 'pending' and analysis_finished_at is null;

create or replace function admin_ai_metrics()
returns jsonb language sql stable set search_path = public as $$
  with runs as (
    select * from ai_admin_runs where created_at >= now() - interval '30 days'
  ), grouped as (
    select purpose, count(*) as requests, count(*) filter (where fallback_used) as fallbacks,
      sum(input_tokens) as input_tokens, sum(output_tokens) as output_tokens,
      sum(estimated_cost) as estimated_cost, percentile_disc(0.5) within group (order by latency_ms) as p50_ms,
      percentile_disc(0.95) within group (order by latency_ms) as p95_ms
    from runs group by purpose
  ), errors as (
    select error_category as category, count(*) as count from runs
    where error_category is not null group by error_category
  )
  select jsonb_build_object(
    'purposes', coalesce((select jsonb_agg(to_jsonb(g) order by g.purpose) from grouped g), '[]'),
    'errors', coalesce((select jsonb_agg(to_jsonb(e) order by e.category) from errors e), '[]'),
    'reanalyses', (select count(*) from admin_audit_log where action = 'review.reanalyze' and created_at >= now() - interval '30 days')
  );
$$;

revoke execute on function admin_ai_metrics() from public, anon, authenticated;
grant execute on function admin_ai_metrics() to service_role;
commit;
