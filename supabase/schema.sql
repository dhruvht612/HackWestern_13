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
