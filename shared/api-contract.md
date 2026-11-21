# AttackSurface API Contract

Base URL (local): `http://localhost:8000`

## Shared Types

```ts
type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Project {
  id: string;
  name: string;
  root_domain: string;
  authorization_confirmed: boolean;
  created_at: string; // ISO 8601
}

interface Asset {
  id: string;
  hostname: string;
  ip_addresses: string[];
  technology: string;
  https: boolean;
  environment: "prod" | "staging" | "dev" | "unknown";
  status: "resolved" | "unresolved";
  last_seen: string; // ISO 8601
}

interface Finding {
  id: string;
  asset_id: string;
  type: string;
  title: string;
  severity: Severity;
  evidence: string;
  remediation: string;
  source: "rules" | "osv";
  references: string[];
}

interface Dependency {
  id: string;
  package_name: string;
  version: string;
  ecosystem: string;
  direct: boolean;
  advisories: Array<{
    id: string;
    summary: string;
    severity: Severity;
    references: string[];
  }>;
  fixed_version: string | null;
}

interface AnalysisFinding {
  finding_id: string;
  summary: string;
  why_it_matters: string;
  business_impact: string;
  remediation: string;
  suggested_priority: string;
  confidence: "high" | "medium" | "low";
  evidence_refs: string[];
}

interface Analysis {
  executive_summary: string;
  findings: AnalysisFinding[];
}

interface GraphNode {
  id: string;
  type: "root" | "asset" | "finding" | "fix";
  label: string;
  severity?: Severity;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

interface Scan {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  events: Array<{ timestamp: string; level: "info" | "warn" | "error"; message: string }>;
}
```

## Endpoints

| Method | Path | Request | Response |
|---|---|---|---|
| POST | `/projects` | `{name, root_domain, authorization_confirmed}` | `Project` |
| GET | `/projects` | - | `Project[]` |
| GET | `/projects/{id}` | - | `Project` |
| POST | `/projects/{id}/scans` | - | `{scan_id}` |
| GET | `/scans/{id}` | - | `Scan` |
| GET | `/scans/{id}/assets` | - | `Asset[]` |
| GET | `/scans/{id}/findings` | - | `Finding[]` |
| POST | `/projects/{id}/dependencies` | multipart file (`package.json` or `package-lock.json`) | `Dependency[]` |
| GET | `/projects/{id}/dependencies` | - | `Dependency[]` |
| GET | `/scans/{id}/graph` | - | `{nodes: GraphNode[], edges: GraphEdge[]}` |
| POST | `/scans/{id}/analysis` | - | `Analysis` |
| GET | `/scans/{id}/report.md` | - | `text/markdown` |
| GET | `/health` | - | `{status: "ok"}` |

## Validation & Safety Rules

- `POST /projects` rejects `authorization_confirmed: false` with **HTTP 400**.
- `root_domain` must be a registrable domain: no IPs, no wildcards, no URL schemes/paths.
- Discovery is passive only: CT logs, DNS, HTTP headers/TLS metadata. No brute-forcing, port scanning, or exploitation.
- Backend stubs return fixtures from `shared/fixtures` so the API works end-to-end on day one.
