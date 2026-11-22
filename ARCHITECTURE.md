# ShadowScope — Architecture

**Last updated:** 2026-11-21 · Related: [PRD.md](PRD.md) · [AI-AGENT.md](AI-AGENT.md) · [DESIGN.md](DESIGN.md) · [shared/api-contract.md](shared/api-contract.md)

## 1. Overview

A React single-page app talks to a FastAPI backend over a typed JSON contract. The backend persists to Supabase (Postgres) and will run three pipeline stages: passive discovery, dependency intel, and AI analysis. Every endpoint has a matching JSON fixture in `shared/fixtures/`, so the frontend can run entirely in mock mode and the backend can stub any stage that isn't built yet.

```mermaid
flowchart LR
  subgraph Browser["Frontend · React 19 + Vite + Tailwind"]
    Pages["Pages (routes)"] --> Hooks["TanStack Query hooks"] --> Client["src/lib/api.ts"]
  end
  Client -- "VITE_USE_MOCKS=true" --> Fixtures[("shared/fixtures/*.json")]
  Client -- "HTTP JSON (VITE_API_URL)" --> API

  subgraph Backend["Backend · FastAPI (backend/attacksurface)"]
    API["Routers"] --> Val["validation.py"]
    API --> Disc["discovery/ · CT, DNS, HTTP/TLS, rules"]
    API --> Intel["intel/ · manifests, OSV, risk"]
    API --> AI["ai/ · Gemini analyst"]
    API --> FL["fixture_loader.py"]
  end
  FL --> Fixtures
  API --> DB[("Supabase Postgres")]
  Disc -. passive .-> Internet(("CT logs · DNS · HTTPS"))
  Intel -. advisories .-> OSV(("OSV.dev"))
  AI -. structured JSON .-> Gemini(("Gemini API"))
```

## 2. Repository layout

```text
.
├── src/                      Frontend (Vite + React + TypeScript)
│   ├── pages/                One component per route
│   ├── layouts/AppLayout.tsx Project shell: band, header, folder-tab nav, sheet
│   ├── components/           Shared UI (Stamp, ClassificationBand, DataTable, SeverityBadge, …)
│   ├── hooks/                One TanStack Query hook per endpoint
│   ├── lib/                  api client, types, severity, markdownBlocks, utils, constants
│   ├── mocks/fixtures.ts     Imports shared/fixtures for mock mode
│   └── styles/               globals.css (design tokens), print.css
├── backend/attacksurface/    FastAPI app (uv project, Python ≥ 3.12)
│   ├── main.py               App, CORS, router registration, /health
│   ├── config.py             Settings from environment
│   ├── routers/              projects, scans, dependencies, analysis, reports, auth
│   ├── database/client.py    Supabase client (service key)
│   ├── jwt.py                HS256 JWT helpers + JWTBearer dependency (not yet wired)
│   ├── schemas.py            Pydantic models, which mirror src/lib/types.ts
│   ├── validation.py         Root-domain validation
│   ├── fixture_loader.py     Reads shared/fixtures
│   └── discovery/ intel/ ai/ Pipeline stages (empty packages today)
├── shared/
│   ├── api-contract.md       Source of truth for endpoints and types
│   └── fixtures/             One JSON (or .md) per endpoint response
├── supabase/schema.sql       Database schema
├── scripts/check-markdown.ts Self-check for the report parser
├── public/fonts/             Self-hosted Archivo, Public Sans, Courier Prime
└── .github/workflows/ci.yml  Frontend + backend CI
```

## 3. Frontend

**Stack:** React 19, React Router 7, TanStack Query 5, Tailwind 3, @xyflow/react (graph), react-dropzone (uploads), lucide-react (icons).

### Routes (`src/router.tsx`)

| Path | Page | Data |
|---|---|---|
| `/` | LandingPage | Static, built from `shared/fixtures` at build time |
| `/projects/new` | NewProjectPage | `POST /projects` |
| `/projects/:id` | DashboardPage | project, scan, assets, findings, dependencies, analysis |
| `/projects/:id/scans/:scanId` | ScanProgressPage | `GET /scans/:id`, polling every 2s until `completed` |
| `/projects/:id/assets` | AssetsPage | assets + findings |
| `/projects/:id/findings` | FindingsPage | findings + assets + analysis |
| `/projects/:id/dependencies` | DependenciesPage | list + upload |
| `/projects/:id/graph` | GraphPage | graph |
| `/projects/:id/report` | ReportPage | `report.md`, parsed by `lib/markdownBlocks.ts` |
| `*` | NotFoundPage | — |

### Data flow

`page → hook (useX) → api.x() → fetch | fixture`. `src/lib/api.ts` checks `import.meta.env.VITE_USE_MOCKS === "true"`. In mock mode it returns the fixture after a short artificial delay; otherwise it calls `VITE_API_URL` (default `http://localhost:8000`). Mock mode is **off unless the variable is exactly `"true"`**, so copy `.env.example` to `.env` for the demo.

Note: app pages currently read the demo scan via `DEMO_SCAN_ID` (`src/lib/constants.ts`) rather than the project's latest scan. Replace this once scans persist.

### Design system

All colors are CSS variables in `src/styles/globals.css` (60/30/10: Abyss Navy, Camel Suede, Electric Kiwi). `tailwind.config.js` reads only those variables. Rules and component specs live in [DESIGN.md](DESIGN.md).

## 4. Backend

**Stack:** FastAPI, Pydantic 2, supabase-py, PyJWT, uv. Entry point: `attacksurface:app` (`uv run fastapi dev`).

### API surface

Everything except `/health` and `/auth/signup|signin|refresh` requires `Authorization: Bearer <Supabase access token>` and is scoped to the caller; another user's IDs return 404.

| Method | Path | Notes |
|---|---|---|
| GET | `/health` | Liveness |
| POST | `/auth/signup`, `/auth/signin`, `/auth/refresh` | Supabase Auth (JSON body, rate-limited) |
| POST / GET | `/auth/signout`, `/auth/me` | |
| POST / GET | `/projects`, `/projects/{id}` | Owner-scoped |
| POST | `/projects/{id}/verification` | Issue a DNS TXT challenge (value shown once, hash stored) |
| POST | `/projects/{id}/verification/check` | Resolve the TXT record; marks verified for 90 days |
| GET / POST | `/projects/{id}/scans` | List; queue a scan (needs verification; one active per project; rate-limited) |
| GET | `/scans/{id}`, `/scans/{id}/events` | Status + collection log |
| POST | `/scans/{id}/cancel` | |
| GET | `/scans/{id}/assets`, `/findings`, `/evidence` | Database rows |
| PATCH | `/assets/{id}` | Correct an inferred environment |
| GET / POST | `/projects/{id}/dependencies` | Upload `package.json`/`package-lock.json` (+ optional `deployed_on` host); OSV matched at upload |
| GET | `/scans/{id}/graph` | Built from stored rows |
| POST / GET | `/scans/{id}/analyze`, `/scans/{id}/analysis` | Queue / read the analyst job |
| GET | `/scans/{id}/report.md` | Markdown, regenerated after scan and analysis |

### Scan lifecycle (target design)

```mermaid
sequenceDiagram
  participant UI
  participant API
  participant Disc as discovery
  participant Intel as intel
  participant AI as ai
  participant DB as Supabase
  UI->>API: POST /projects/{id}/scans
  API->>DB: insert scan (queued)
  API-->>UI: {scan_id}
  API->>Disc: run (background task)
  Disc->>DB: scan_events, assets, rule findings
  Intel->>DB: dependency findings (osv) linked to host
  API->>DB: graph edges (derived), scan completed
  UI->>API: GET /scans/{id} (poll 2s)
  UI->>API: POST /scans/{id}/analysis
  API->>AI: findings + assets + deps
  AI-->>API: Analysis (validated JSON)
  API->>DB: reports.markdown
```

Run stages as FastAPI background tasks (or a worker) so `POST /scans` returns immediately. Each stage appends `scan_events` so the UI log stays truthful.

## 5. Data model (`supabase/schema.sql`)

```mermaid
erDiagram
  projects ||--o{ scans : has
  projects ||--o{ dependencies : has
  scans ||--o{ assets : discovers
  scans ||--o{ findings : produces
  scans ||--o{ scan_events : logs
  scans ||--|| reports : renders
  assets ||--o{ findings : "is subject of"
```

- All IDs are UUIDs (`gen_random_uuid()`), with `ON DELETE CASCADE` from parents.
- Enum-like `CHECK` constraints cover scan `status`, asset `environment`/`status`, finding `severity`/`source`, and event `level`.
- `dependencies.advisories` is `jsonb` and holds the advisory list.
- **Gap:** `dependencies` has no `asset_id`, so the host ↔ package correlation can't be stored. Add a nullable `asset_id uuid references assets(id)`.
- `graph` and `analysis` have no tables; derive the graph from assets, findings and fixes, and cache the analysis in `reports` or a new `analyses` table.

## 6. The shared contract

The API contract is defined in four places that must change together:

1. `shared/api-contract.md` (the documented source of truth)
2. `backend/attacksurface/schemas.py` (Pydantic)
3. `src/lib/types.ts` (TypeScript)
4. `shared/fixtures/*.json` (example payloads for both mock mode and stubs)

## 7. Configuration

| Variable | Used by | Notes |
|---|---|---|
| `VITE_API_URL` | frontend | Default `http://localhost:8000` |
| `VITE_USE_MOCKS` | frontend | Must be `"true"` to use fixtures |
| `SUPABASE_URL` | backend | **Required at import** |
| `SUPABASE_SERVICE_KEY` | backend | **Required at import**. Service role: server-side only |
| `JWT_SECRET` | backend | **Required at import**. Missing from `.env.example` |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | backend | For the AI analyst (default `gemini-2.0-flash`) |
| `SCAN_RATE_LIMIT_PER_MIN` | backend | Default 30. Declared but not yet enforced |

CORS allows `http://localhost:5173` only; add the deployed frontend origin for production.

## 8. Build, CI, deploy

- **Local:** `make install`, then `make dev` (both servers), or `make frontend` / `make backend`.
- **CI** (`.github/workflows/ci.yml`): the frontend job runs `npm ci`, lint, typecheck and build. The backend job runs `uv sync --locked`, ruff and pytest.
- **Frontend deploy:** Vercel; `vercel.json` rewrites every path to `index.html` for SPA routing.
- **Backend deploy:** not yet defined.

## 9. Security model

- **Passive only:** discovery may read CT logs, DNS, and one HTTP(S) request per host for headers and certificates. No port scans, brute force, or payloads.
- **Authorization gate:** `POST /projects` rejects `authorization_confirmed=false`, and `validation.py` rejects anything that isn't a registrable domain.
- **Secrets:** the Supabase service key bypasses row-level security, so it lives only on the server. Nothing secret goes in `VITE_*`.
- **Prompt safety:** collected data (headers, banners) is untrusted input to the AI analyst; see [AI-AGENT.md](AI-AGENT.md).

## 10. Status and known limitations (backend v1)

Implemented and tested with mocks: env loading without import-time secrets; Supabase token verification (HS256 secret or JWKS; `exp`, `aud`, `iss`, `sub`); POST auth endpoints; owner-scoped projects and child resources (404 for others' data); DNS TXT domain verification; rate limits; SSRF/scope guards; durable DB-queued scans and analyses with a worker; CT, DNS, HTTP/TLS collectors; rules engine; npm manifest parsing; OSV matching; host ↔ package mapping; database-built graph, analysis (Gemini + validated output + deterministic fallback), and Markdown reports.

| Limitation | Notes |
|---|---|
| Not run against live services in CI | crt.sh, DNS, target hosts, OSV.dev, Supabase Auth, and Gemini are exercised through mocks; first live run needs real credentials |
| Rate limiter is per process | Use one API instance or move it to Redis/Postgres |
| Sign-out doesn't revoke tokens | Client discards them; access tokens expire on Supabase's schedule |
| crt.sh is the only CT source | When it fails the scan continues on the root only and is marked `partial` |
| Environment classification is a hostname heuristic | Shown with its confidence; owners can correct it (`PATCH /assets/{id}`) |
| Only npm manifests | `package.json` ranges are stored as unresolved and not queried |
| Frontend has no unit-test framework | Typecheck, lint, build, and a browser smoke test cover it |
