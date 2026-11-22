# ShadowScope API

FastAPI backend in `backend/attacksurface/`, managed with [uv](https://docs.astral.sh/uv/). Python 3.12.

```sh
uv sync --all-groups                 # install (add --system-certs behind a TLS-intercepting proxy)
uv run fastapi dev                   # API on http://localhost:8000 (docs at /docs)
uv run python -m attacksurface.worker   # job worker (production; dev runs jobs inline)
uv run pytest -q                     # tests: no credentials, no network
uv run ruff check .
```

Configuration is read from the environment, then `backend/.env`, then the repo-root `.env`
(see `../.env.example`). Nothing is required to import or test the app; endpoints that need
Supabase return 503 until it is configured.

| Module | Role |
|---|---|
| `config.py` | Settings (env + `.env`, never raises at import) |
| `jwt.py` | Verifies Supabase access tokens (HS256 secret or JWKS), `get_current_user` |
| `store.py` | Ownership-scoped data access, verification status, scan events |
| `netsafety.py` | Scope and SSRF guards (public IPs only, root + subdomains only) |
| `ratelimit.py` | Per-instance sliding-window limiter |
| `discovery/` | `ct.py` (crt.sh), `dns.py`, `http_meta.py` (GET / on 80/443, TLS cert), `rules.py` |
| `intel/` | `deps.py` (package.json / package-lock.json), `osv.py` (OSV.dev) |
| `scanner.py` | The scan job: CT → DNS → HTTP/TLS → rules → dependency correlation → report |
| `ai/` | `policy.py` (priorities + fallback), `gemini.py`, `analyst.py` (validation) |
| `graph.py`, `reports.py` | Graph and Markdown report built from stored rows |
| `worker.py` | Polls queued scans/analyses from the database |
| `routers/` | `auth`, `projects` (+ verification, scans), `scans`, `dependencies`, `analysis`, `reports` |

## Admin bootstrap

The admin portal (see `../ADMIN-PANEL.md`) needs its schema and one operator before it does anything.

1. Re-apply `supabase/schema.sql` in the Supabase SQL editor. It is idempotent: existing data is
   kept, existing users get a `user_status` row, and projects already DNS-verified are approved
   (with an audit row each).
2. Run `supabase/tests/admin_portal_selftest.sql` in the SQL editor. Every block prints `PASS:`
   and the script ends with `ROLLBACK`, leaving nothing behind. Any `FAIL:` stops it.
3. Make the first operator (an account that already signed up):
   ```sql
   insert into admin_users (user_id, role) select id, 'operator' from auth.users where email = '<operator email>';
   ```
4. Sign in as that account and set up two-factor at `/account/security`. With `APP_ENV=production`,
   admin routes always require two-factor.
5. Start the worker with `uv run --locked python -m attacksurface.worker` from `backend/`. Keep one
   worker running to process account bans and review advice, update its heartbeat, and prune
   security events after 90 days. Audit entries have separate retention.

Review routing requires a current DNS proof before an operator can approve a domain for scanning.
Set `REVIEW_ALL_DOMAINS=true` to send every newly routed verified domain to manual review.
DNS rechecks compare against the hash from the last verified challenge. A legacy project with no
stored hash needs a new owner-issued challenge before an operator can recheck it.
