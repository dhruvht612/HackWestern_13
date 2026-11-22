# Issues log

Every issue, fault, and error hit while building and testing AttackSurface (HackWestern 13, 2026-11-21): the symptom, the cause, and how it was resolved.

**Status:** **Fixed** = code change · **Config** = environment or setup, no code · **Open** = still to do · **Expected** = working as designed

## Summary

| # | Issue | Area | Status |
|---|---|---|---|
| 1 | Verification failed although the TXT record existed | Verification | Fixed |
| 2 | TXT record created at a doubled name | Verification | Config |
| 3 | Old token left on the correct record name | Verification | Config |
| 4 | "Too many requests" during manual testing | Rate limits | Fixed |
| 5 | App requires an account / confirmation email | Auth | Expected |
| 6 | Supabase signs tokens with ES256, not HS256 | Auth | Fixed |
| 7 | CORS errors and "Failed to fetch" on sign-in | Auth / config | Config |
| 8 | SSL `CERTIFICATE_VERIFY_FAILED` to Supabase, OSV, crt.sh | Network | Fixed |
| 9 | `USE_SYSTEM_CERTS` missing from `.env`, so the fix didn't apply | Network / config | Config |
| 10 | 8 of 9 tables missing on Supabase (`PGRST205`) | Database | Config |
| 11 | Tables existed but returned permission denied (`42501`) | Database | Fixed |
| 12 | Existing projects orphaned (no owner) | Database | Config |
| 13 | Tests passed while the real database was broken | Testing | Open |
| 14 | Gemini model returned 404 (deprecated) | AI analyst | Fixed |
| 15 | `useAnalysis` export missing at runtime | Frontend | Fixed |
| 16 | 504 "Outdated Optimize Dep" / blank first visits | Dev server | Fixed |
| 17 | Stale Vite server on :5173 hijacking the browser | Dev server | Config |
| 18 | `bg-navy-raised class does not exist` / CSS 500 | Dev server | Config |
| 19 | Vite crashed on startup (CAC CLI error) | Dev server | Config |
| 20 | PR #8 merge conflict with the Client API Docs feature | Git | Fixed |
| 21 | Automated conflict-port script failed on an import assertion | Git / tooling | Fixed |
| 22 | Uploaded `package.json` produced no advisory matches | Dependency intel | Open |
| 23 | Windows tooling: `Start-Process npx` failed | Tooling | Config |

---

## Domain verification

### 1. Verification failed although the TXT record existed — Fixed
- **Symptom:** "The TXT record wasn't found yet." But `nslookup` against Namecheap, 1.1.1.1, and 8.8.8.8 all returned the token.
- **Cause:** the app used the machine's resolver (campus DNS, `172.23.40.1` / `129.100.74.79`). It had cached NXDOMAIN from a lookup made before the record existed, and kept serving it.
- **Fix:** `lookup_txt` in `backend/attacksurface/discovery/dns.py` queries 1.1.1.1 and 8.8.8.8 directly. Scan DNS still uses the system resolver.

### 2. TXT record created at a doubled name — Config
- **Symptom:** the record appeared at `_attacksurface-challenge.thakardhruv.me.thakardhruv.me`.
- **Cause:** the full name was typed into Namecheap's Host field; Namecheap appends the domain itself.
- **Fix:** Host = `_attacksurface-challenge` only.
- **Open:** say this on the verification screen and add a copy button.

### 3. Old token left on the correct record name — Config
- **Symptom:** the correctly named record held a token from an earlier challenge.
- **Cause:** issuing a new challenge replaces the stored hash, so older TXT values stop matching.
- **Fix:** keep one `_attacksurface-challenge` record and update it to the latest token. Don't re-issue while waiting for DNS.
- **Open:** warn in the UI that re-issuing invalidates the previous token.

## Rate limits and auth

### 4. "Too many requests" during manual testing — Fixed
- **Symptom:** HTTP 429 after repeated sign-ins and DNS checks.
- **Cause:** per-minute limits (sign-up 5, sign-in 10, DNS check 6, …) are sized against abuse, not a person retrying by hand.
- **Fix:** `RATE_LIMIT_SCALE` multiplies every limit (`config.py`, `ratelimit.py`). 10 locally, 1 in production. Restarting the API also clears the in-memory counters.

### 5. App requires an account / confirmation email — Expected
- Real mode (`VITE_USE_MOCKS=false`) scopes projects to their owner, so sign-up is required, and Supabase sends a confirmation email first.
- **Watch out:** Supabase's built-in mailer allows only a few emails per hour. Configure custom SMTP before public sign-ups.

### 6. Supabase signs tokens with ES256, not HS256 — Fixed
- **Cause:** the project uses asymmetric JWT signing keys, so an HS256-only verifier rejects every token.
- **Fix:** tokens are verified against the project's JWKS; the HS256 secret is only a legacy fallback.

### 7. CORS errors and "Failed to fetch" on sign-in — Config
- **Symptom:** the browser blocked `/auth/signin` and `/auth/refresh` (no `Access-Control-Allow-Origin`). The API log showed the Supabase client failing with "Invalid URL". `/health` still returned 200.
- **Cause:** `SUPABASE_URL` was missing from `.env`, so every auth route errored before CORS headers were added. A stale Vite server (#17) was also answering on :5173.
- **Fix:** restored `SUPABASE_URL` and `USE_SYSTEM_CERTS`, stopped the stale server. If it recurs, check the API on :8000 and that `CORS_ORIGINS` includes `http://localhost:5173`.

## Network and TLS

### 8. SSL `CERTIFICATE_VERIFY_FAILED` to Supabase, OSV, crt.sh — Fixed
- **Symptom:** every outbound HTTPS call from Python failed with "unable to get local issuer certificate".
- **Cause:** Norton Antivirus intercepts HTTPS and re-signs it with "Norton Web/Mail Shield Root", which Python's bundled CA list doesn't trust.
- **Fix:** opt-in `USE_SYSTEM_CERTS=true` loads the Windows certificate store via `truststore`.

### 9. `USE_SYSTEM_CERTS` missing from `.env`, so the fix didn't apply — Config
- **Symptom:** SSL errors continued after the truststore change.
- **Cause:** `.env` was created from an older template without the flag.
- **Fix:** added `USE_SYSTEM_CERTS=true` to `.env` and the flag (default `false`) to `.env.example`.

## Database

### 10. 8 of 9 tables missing on Supabase (`PGRST205`) — Config
- **Symptom:** "Could not find the table in the schema cache" for scans, assets, evidence, findings, dependencies, scan_events, reports, analyses.
- **Cause:** only `projects` existed; `supabase/schema.sql` hadn't been applied.
- **Fix:** ran `supabase/schema.sql` in the Supabase SQL editor.

### 11. Tables existed but returned permission denied (`42501`) — Fixed
- **Cause:** tables were created without grants for the API roles.
- **Fix:** explicit `grant` statements added to `supabase/schema.sql`.

### 12. Existing projects orphaned (no owner) — Config
- **Symptom:** 6 test projects (`testing.com` … `testing5.com`) had `owner_user_id = NULL`, so no user could see them.
- **Cause:** they were created before ownership existed.
- **Fix:** ignore or delete them, or assign an owner (`update projects set owner_user_id = '<uuid>' where owner_user_id is null;`, documented in `schema.sql`).

## Testing

### 13. Tests passed while the real database was broken — Open
- **Symptom:** 75 tests passed while 8 tables were missing (#10).
- **Cause:** tests use an in-memory fake Supabase, by design: they never touch real credentials.
- **Open:** add a smoke check script that hits a real project (tables, grants, auth settings) before demos and deploys.

## AI analyst

### 14. Gemini model returned 404 (deprecated) — Fixed
- **Cause:** `gemini-2.5-flash` is no longer available to new API users; the key itself was valid.
- **Fix:** default and `.env` set to `gemini-3.8-flash`.

## Frontend and dev server

### 15. `useAnalysis` export missing at runtime — Fixed
- **Symptom:** blank `/projects` page: "does not provide an export named 'useAnalysis'". The typecheck had passed.
- **Cause:** the dashboard imported hooks that weren't exported yet; Vite served a stale module in the meantime.
- **Fix:** `src/hooks/useAnalysis.ts` exports `useAnalysis` and `useRequestAnalysis`.

### 16. 504 "Outdated Optimize Dep" / blank first visits — Fixed
- **Symptom:** `@tanstack/react-query`, `react-router-dom`, and `react/jsx-dev-runtime` returned 504 from `node_modules/.vite/deps`, and routes loaded blank.
- **Cause:** route-only dependencies were discovered lazily, so Vite re-optimized mid-session and invalidated chunks already loaded.
- **Fix:** pre-bundle them via `optimizeDeps.include` in `vite.config.ts`.

### 17. Stale Vite server on :5173 hijacking the browser — Config
- **Symptom:** "server connection lost", font preload warnings, the browser loading from 5173 while the current server was on another port.
- **Cause:** an earlier Vite process was never stopped (window closed instead of Ctrl+C).
- **Fix:**
  ```powershell
  Get-NetTCPConnection -LocalPort 5173 -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }
  ```

### 18. `bg-navy-raised class does not exist` / CSS 500 — Config
- **Symptom:** PostCSS overlay on `src/styles/globals.css:159`; `globals.css` returned 500.
- **Cause:** the same stale Vite process (#17), running hours-old Tailwind state. `tailwind.config.js` defines `navy.raised`, and a fresh build compiled cleanly.
- **Fix:** kill the stale process, delete `node_modules/.vite`, restart, hard-refresh.

### 19. Vite crashed on startup (CAC CLI error) — Config
- **Symptom:** Vite exited with code 1 inside its CLI parser (`vite/dist/node/cli.js:734`) right after the API came up.
- **Cause:** not pinned down. It happened while other Vite instances held ports, and didn't recur after the stale servers were cleared and Vite was started cleanly.
- **Fix:** start with a free port (`npm run dev`, or `vite --port <n> --strictPort`).

## Git and tooling

### 20. PR #8 merge conflict with the Client API Docs feature — Fixed
- **Cause:** `main` gained a teammate's `api_docs` change (4 commits) that edited the same files as `backend-v1`: `routers/projects.py` and `schemas.py`.
- **Fix:** merged it with owner-only access and validation; 76 tests passed and CI went green before PR #8 merged.
- **Open:** apply the `api_docs` column to the production database.

### 21. Automated conflict-port script failed on an import assertion — Fixed
- **Cause:** the script looked for a one-line `from attacksurface.schemas import …` but the file uses a multi-line parenthesized import.
- **Fix:** edited the imports by hand. Lesson: patch by structure, not by exact string match.

### 22. Uploaded `package.json` produced no advisory matches — Open
- **Cause:** `package.json` lists ranges (`^19.3.0`), and OSV needs exact versions. The manifest also wasn't mapped to a host, so nothing could be correlated.
- **Workaround:** upload `package-lock.json` (or `shared/samples/vulnerable-package-lock.json`), choose the "deployed on" host, rescan.
- **Open:** prompt for the lockfile when a range-only manifest is uploaded.

### 23. Windows tooling: `Start-Process npx` failed — Config
- **Cause:** on Windows `npx` is a `.cmd` shim, which `Start-Process` can't launch by bare name.
- **Fix:** use `npm run dev` / `make dev`, or `node node_modules/vite/bin/vite.js`.

---

## Still open
1. Verification UX: registrar-friendly host text, a copy button, a warning on re-issue (#2, #3).
2. Smoke check against a real Supabase project before demos and deploys (#13).
3. Lockfile prompt for range-only manifests (#22).
4. Apply the `api_docs` column in production (#20).
5. Custom SMTP for Supabase auth emails (#5).
6. Rotate the Supabase service-role and Gemini keys used during development.
