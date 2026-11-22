# Issues log

Problems hit while building and testing AttackSurface locally (HackWestern 13, 2026-11-21), what caused each one, and how it was resolved. Newest first within each section.

Status: **Fixed** (code change) · **Config** (environment or setup, no code) · **Open** (still to do).

## Domain verification

### 1. Verification said "TXT record wasn't found" although the record existed — Fixed
- **Symptom:** `nslookup` against Namecheap, 1.1.1.1, and 8.8.8.8 all returned the token, but the app kept answering "The TXT record wasn't found yet."
- **Cause:** the app used the machine's resolver (campus network DNS, `172.23.40.1` / `129.100.74.79`). It had cached an NXDOMAIN from a lookup made before the record existed and kept serving it.
- **Fix:** `lookup_txt` in `backend/attacksurface/discovery/dns.py` now queries public resolvers (1.1.1.1, 8.8.8.8) directly. Ownership checks no longer depend on the local network. Scan DNS still uses the system resolver.

### 2. TXT record created at a doubled name — Config
- **Symptom:** the record showed up at `_attacksurface-challenge.thakardhruv.me.thakardhruv.me`.
- **Cause:** the full name was typed into Namecheap's Host field; Namecheap appends the domain itself.
- **Fix:** Host must be just `_attacksurface-challenge`.
- **Open:** the verification screen should say this and offer a copy button (see PRD §11).

### 3. An old token sat on the correct record name — Config
- **Symptom:** the correctly named record held a token from an earlier challenge.
- **Cause:** issuing a new challenge replaces the stored hash, so older TXT values stop matching.
- **Fix:** keep one `_attacksurface-challenge` TXT record and update its value to the latest token. Don't re-issue while waiting on DNS.
- **Open:** warn in the UI that re-issuing invalidates the previous token.

## Rate limits and auth

### 4. "Too many requests" during manual testing — Fixed
- **Symptom:** HTTP 429 after repeated sign-in attempts and DNS checks.
- **Cause:** per-minute limits (sign-up 5, sign-in 10, DNS check 6, …) are sized for production abuse, not for a person retrying by hand.
- **Fix:** new `RATE_LIMIT_SCALE` setting multiplies every limit (`backend/attacksurface/config.py`, `ratelimit.py`). Set it to 10 locally, keep 1 in production. Restarting the API also clears the in-memory counters.

### 5. The app requires an account — Expected behaviour
- Real mode (`VITE_USE_MOCKS=false`) needs sign-up so projects are scoped to their owner. Supabase sends a confirmation email first.
- **Watch out:** Supabase's built-in mailer allows only a few emails per hour. Configure custom SMTP before public sign-ups (PRD §11).

### 6. Supabase signs tokens with ES256, not HS256 — Fixed
- **Cause:** the project uses asymmetric JWT signing keys.
- **Fix:** tokens are verified via the project's JWKS; the legacy HS256 secret is only a fallback.

### 7. "Failed to fetch" on sign-in — Config
- **Cause:** `.env` was missing `SUPABASE_URL` and `USE_SYSTEM_CERTS`, and a stale Vite server on :5173 was answering instead of the current one.
- **Fix:** restored the values, stopped the stale server. If it recurs, check the API is up on :8000 and `CORS_ORIGINS` includes `http://localhost:5173`.

## Network and TLS

### 8. SSL certificate verification failed for Supabase/Gemini — Fixed
- **Cause:** Norton Antivirus intercepts HTTPS and re-signs it with its own root CA, which Python's bundled CA list doesn't trust.
- **Fix:** opt-in `USE_SYSTEM_CERTS=true` loads the Windows certificate store via `truststore`.

## Database

### 9. Tables existed but queries failed with permission errors — Fixed
- **Cause:** the tables were created without grants for the API roles.
- **Fix:** explicit `grant` statements added to `supabase/schema.sql`.

### 10. Merge conflict with the Client API Docs feature — Fixed
- **Cause:** `backend-v1` and a teammate's `api_docs` change both edited `routers/projects.py` and `schemas.py`.
- **Fix:** merged it with owner-only access and validation (PR #8).
- **Open:** apply the `api_docs` column to the production database.

## AI analyst

### 11. Gemini model unavailable — Fixed
- **Cause:** `gemini-2.5-flash` is deprecated for new API users.
- **Fix:** default and `.env` set to `gemini-3.8-flash`.

## Frontend dev server

### 12. `The bg-navy-raised class does not exist` (PostCSS overlay) — Config
- **Symptom:** Vite's error overlay on `src/styles/globals.css`; CSS requests returned 500.
- **Cause:** a Vite process started hours earlier was still holding :5173 with a stale Tailwind setup. The config defines `navy.raised`, and a fresh build compiled cleanly.
- **Fix:** kill the stale process, clear `node_modules/.vite`, restart. Stop dev servers with Ctrl+C, not by closing the window.
  ```powershell
  Get-NetTCPConnection -LocalPort 5173 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }
  ```

### 13. 504 "Outdated Optimize Dep" / blank page on first visit to a route — Fixed
- **Cause:** route-only dependencies were discovered lazily, so Vite re-optimized mid-session and invalidated chunks.
- **Fix:** pre-bundle them via `optimizeDeps.include` in `vite.config.ts`.

## Dependency intel

### 14. Uploaded `package.json` produced no advisory matches — Open
- **Cause:** `package.json` lists ranges (`^19.3.0`), and OSV needs exact versions. The manifest also wasn't mapped to a host, so nothing could be correlated.
- **Workaround:** upload `package-lock.json` (or `shared/samples/vulnerable-package-lock.json`), choose the "deployed on" host, rescan.
- **Open:** prompt for the lockfile when a range-only manifest is uploaded.
