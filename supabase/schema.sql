-- AttackSurface schema.
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
create index if not exists auth_outbox_pending on auth_outbox (status, created_at);

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

-- Every new account gets a status row, however it was created (API, dashboard, invite).
-- security definer: the Auth service inserts into auth.users with a role that has no rights here.
create or replace function handle_new_auth_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_status (user_id, status, risk_level, status_reason)
  values (new.id, 'active', 'low', 'signup')
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
  if p_status is null or p_status not in ('active', 'suspended') then raise exception 'invalid_status'; end if;
  if p_actor = p_target then raise exception 'self_action'; end if;
  if not exists (select 1 from admin_users where user_id = p_actor and role = 'operator') then
    raise exception 'not_operator';
  end if;
  select status into v_prev from user_status where user_id = p_target for update;
  if not found then raise exception 'not_found'; end if;

  update user_status set status = p_status, status_reason = btrim(p_reason), updated_at = now()
  where user_id = p_target;
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
