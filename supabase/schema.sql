-- AttackSurface schema
-- UUID primary keys, foreign key cascades, timestamps, severity checks, and scan/project indexes.

create extension if not exists "pgcrypto";

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  root_domain text not null,
  api_docs text null,
  authorization_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint projects_root_domain_not_blank check (length(trim(root_domain)) > 0)
);

create table if not exists scans (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'completed', 'failed')),
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

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

create table if not exists findings (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  asset_id uuid not null references assets(id) on delete cascade,
  type text not null,
  title text not null,
  severity text not null check (severity in ('critical', 'high', 'medium', 'low', 'info')),
  evidence text not null,
  remediation text not null,
  source text not null check (source in ('rules', 'osv')),
  references text[] not null default '{}',
  created_at timestamptz not null default now()
);

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

create table if not exists scan_events (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  timestamp timestamptz not null default now(),
  level text not null check (level in ('info', 'warn', 'error')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references scans(id) on delete cascade,
  markdown text not null,
  created_at timestamptz not null default now(),
  unique (scan_id)
);

create index if not exists idx_scans_project_id on scans(project_id);
create index if not exists idx_assets_scan_id on assets(scan_id);
create index if not exists idx_findings_scan_id on findings(scan_id);
create index if not exists idx_findings_asset_id on findings(asset_id);
create index if not exists idx_dependencies_project_id on dependencies(project_id);
create index if not exists idx_scan_events_scan_id on scan_events(scan_id);
create index if not exists idx_reports_scan_id on reports(scan_id);
