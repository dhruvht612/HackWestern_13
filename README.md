# AttackSurface

AttackSurface builds the file an attacker would keep on you: it passively maps what a domain exposes, links exposed hosts to the vulnerable dependencies behind them, and ranks what to fix first.

**Docs:** [PRD.md](PRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md) · [AI-AGENT.md](AI-AGENT.md) · [DESIGN.md](DESIGN.md) · [backend/README.md](backend/README.md)

## How it works

1. Sign up / sign in (Supabase Auth).
2. Create a project for a root domain and confirm you're authorized.
3. Prove domain control with a DNS TXT record. Scans are blocked until it verifies.
4. Start a scan. A worker collects Certificate Transparency names, DNS, and one `GET /` per in-scope public host on ports 80/443 (headers + TLS certificate), then runs deterministic rules.
5. Upload `package-lock.json` (optionally mapped to the host it ships on); packages are matched against OSV.dev.
6. Request analysis: Gemini writes a validated triage memo, or a deterministic fallback does when Gemini is unavailable.
7. Read findings, the attack-path graph, and the Markdown report.

No port scanning, brute forcing, crawling, or exploitation. Findings are potential exposure to validate.

## Repo layout

```text
src/                  Frontend: React 19 + Vite + Tailwind (pages, hooks, lib/api.ts)
backend/attacksurface FastAPI app (see backend/README.md)
backend/tests         Pytest suite (no credentials, no network)
supabase/schema.sql   Idempotent schema + RLS (also the upgrade path)
shared/               API contract + demo fixtures (frontend demo mode only)
scripts/              check-markdown.ts (report parser self-check)
```

## Setup

**Prerequisites:** Node 20+, Python 3.12, [uv](https://docs.astral.sh/uv/), a Supabase project.

```bash
npm install
uv sync --project backend --all-groups     # add --system-certs behind a TLS-intercepting proxy
cp .env.example .env                       # then fill it in
```

**Supabase**
1. Project Settings → API: copy the URL, `anon` key, and `service_role` key into `.env`.
2. Project Settings → JWT Keys: if user tokens are still signed with the legacy shared secret, copy it to `SUPABASE_JWT_SECRET`. Projects on asymmetric signing keys need nothing more (tokens are verified via JWKS).
3. Authentication → Providers: enable Email. If "Confirm email" is on, users confirm before signing in.
4. Apply the schema: paste `supabase/schema.sql` into the SQL editor, or `psql "$DATABASE_URL" -f supabase/schema.sql`. It is idempotent and additive (re-run it after pulling changes). Projects created before ownership existed need an owner: `update projects set owner_user_id = '<user uuid>' where owner_user_id is null;`

**Gemini (optional):** set `GEMINI_API_KEY` (and `GEMINI_MODEL`). Without it, analysis uses the deterministic fallback and says so.

## Run

```bash
make dev                                   # API :8000 + frontend :5173 (jobs run inline)
# or separately:
make backend
make frontend
cd backend && uv run python -m attacksurface.worker   # production-style worker (set RUN_JOBS_INLINE=false on the API)
```

**Demo mode:** `VITE_USE_MOCKS=true npm run dev` serves the labelled `acme-demo.com` fixtures with no backend and no sign-in.

## Test

```bash
make test        # backend pytest + frontend typecheck
make lint        # eslint + ruff
node --experimental-strip-types scripts/check-markdown.ts
npm run build
```

CI (`.github/workflows/ci.yml`) runs lint, typecheck, and build for the frontend and ruff + pytest for the backend; it needs no secrets.

## Deploy

- **Frontend:** Vercel (`vercel.json` rewrites every path to `index.html`). Set `VITE_API_URL` to the API URL and `VITE_USE_MOCKS=false`.
- **API:** any container/Python host: `uv run fastapi run attacksurface/main.py` in `backend/`, with `APP_ENV=production`, `RUN_JOBS_INLINE=false`, `CORS_ORIGINS` / `FRONTEND_URL` set to the deployed frontend.
- **Worker:** a second process: `uv run python -m attacksurface.worker`.
- The rate limiter is per process: run one API instance, or move it to a shared store.

## Safety rules

- Authorized targets only: attestation at project creation **and** DNS TXT proof of control before any scan. Verification lasts 90 days.
- Scope is the verified root and its subdomains. Redirect targets and third-party infrastructure are never contacted.
- Hosts resolving to any non-public address (private, loopback, link-local, metadata) are skipped. Connections are pinned to the validated IP.
- Never put backend secrets in `VITE_*` variables.
