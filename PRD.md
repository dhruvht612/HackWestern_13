# ShadowScope — Product Requirements

**Status:** v1 built and validated on a live domain (HackWestern 13) · **Last updated:** 2026-11-21
Related: [PRODUCT.md](PRODUCT.md) (product truth) · [DESIGN.md](DESIGN.md) (visual system) · [ARCHITECTURE.md](ARCHITECTURE.md) · [AI-AGENT.md](AI-AGENT.md) · [shared/api-contract.md](shared/api-contract.md)

## 1. Problem

Teams don't know what an outsider can see of their infrastructure. Subdomains leak through certificate logs, staging and dev hosts stay reachable, response headers advertise versions, and vulnerable dependencies ship behind production APIs. The data exists, but it's split across tools: scanners list hosts, dependency tools list CVEs, and nobody connects the two or says what to fix first.

## 2. Product

ShadowScope builds the file an attacker would keep on you, then tells you what to fix first. Given a root domain the user has proven they control, it runs one pipeline:

1. **Discover:** passively map exposed assets from Certificate Transparency logs, DNS, and HTTP/TLS metadata.
2. **Correlate:** link each exposed host to the vulnerable dependencies running behind it, so findings form exposure paths rather than two lists.
3. **Prioritize:** an AI analyst (Gemini) turns findings into P0–P3 priorities with business impact and remediation, with a deterministic fallback when the model is unavailable.

## 3. Users

| User | Situation | Job |
|---|---|---|
| **Hackathon judge** (primary, now) | ~30 seconds at a demo table | Understand the pipeline, believe it works, click into the demo |
| **Small engineering team** | No dedicated security person | Know what's exposed before an attacker does, and what to fix first |
| **AppSec engineer / authorized tester** | Scoped engagement | Fast passive recon with evidence they can hand off |

## 4. Goals and non-goals

**Goals**
- A first-time visitor can repeat "discover → correlate → prioritize" after one screen.
- Every finding carries raw evidence and a remediation.
- One clear top priority per scan, with the reasoning shown.
- The scope is honest and enforced: passive, verified ownership, potential exposure.

**Non-goals**
- Active scanning, port scanning, brute force, exploitation, or payloads of any kind.
- Scanning domains whose control the user hasn't proven via DNS.
- Continuous monitoring, alerting, ticketing integrations, or multi-tenant billing (post-hackathon).
- Proving exploitability. Findings are potential exposure to be validated.

## 5. User stories

1. As a visitor, I can understand what ShadowScope does from the landing page and open a demo without signing up.
2. As a user, I can sign up and sign in with email and password; my projects are visible only to me.
3. As a user, I can create a project by naming it and entering a root domain.
4. As a user, I can prove I control the domain by adding a DNS TXT record, and scanning stays locked until I do.
5. As a user, I can start a scan and watch a timestamped collection log until it completes.
6. As a user, I can see every discovered host with its environment, IPs, technology, HTTPS status, and worst finding.
7. As a user, I can filter findings by severity and read each one's evidence, remediation, and analyst memo.
8. As a user, I can upload `package.json` / `package-lock.json`, choose the host it's deployed on, and see packages matched to advisories with fixed versions.
9. As a user, I can trace a host to its findings and fixes on an attack-path graph.
10. As a user, I can read a one-paragraph executive summary and a ranked "fix first" list.
11. As a user, I can export the report as Markdown or print it to PDF.

## 6. Functional requirements

Status: **Built** works end to end against Supabase · **Validated** also exercised in the live test (§9).

| ID | Requirement | Status |
|---|---|---|
| FR-1 | Create, list, and get projects, scoped to the signed-in owner | Validated |
| FR-2 | Validate `root_domain` as a registrable domain: no IPs, wildcards, schemes, paths, or ports | Validated |
| FR-3 | **Ownership verification:** issue a DNS TXT challenge at `_attacksurface-challenge.<domain>` (value shown once, only its hash stored, expires); check it via public resolvers; scans return 403 until verified | Validated |
| FR-4 | Start a scan per project; scan states `queued → running → completed / partial / failed / cancelled`; cancel a running scan | Validated |
| FR-5 | Scan log events (`info`/`warn`/`error`) with timestamps; UI polls every 2s until complete | Validated |
| FR-6 | Discovery: CT logs (crt.sh) → hostnames; DNS (A/AAAA/CNAME) → IPs; one `GET /` per host on 80 and 443 → headers, server, redirect; TLS → issuer, SANs, validity, trust | Validated |
| FR-7 | Environment inference per host (`prod`/`staging`/`dev`/`unknown`), stored with its source and confidence | Validated |
| FR-8 | Rule findings: `headers.hsts_missing`, `headers.csp_missing`, `headers.frame_options_missing`, `headers.version_disclosure`, `http.no_https_redirect`, `tls.expired`, `tls.expiring`, `tls.untrusted`, `exposure.nonprod_reachable` | Validated (`headers.csp_missing` fired) |
| FR-9 | Dependency upload (`package.json`, `package-lock.json`) → packages, direct vs transitive, dev vs prod | Validated (upload) |
| FR-10 | OSV advisory matching on exactly resolved versions, with severity and fixed version | Built (test suite + sample lockfile) |
| FR-11 | **Correlation:** each manifest is linked to its "deployed on" host (`asset_id`); advisories become findings on that host | Built |
| FR-12 | AI analysis: executive summary, per-finding memo (priority, impact, confidence, evidence refs), and missing-evidence list; schema-validated, deterministic fallback | Validated (`gemini-3.8-flash`) |
| FR-13 | Attack-path graph: root → host → finding → fix | Built |
| FR-14 | Markdown report per scan; Markdown export and print-to-PDF | Validated (report generated) |
| FR-15 | Sign-up / sign-in / refresh / sign-out via Supabase Auth; tokens verified via JWKS (ES256) or the legacy HS256 secret | Validated |
| FR-16 | Client API docs per project (`GET`/`POST /projects/{id}/api_docs`), owner only | Built |
| FR-17 | Mock mode: every page works from `shared/fixtures` with no backend (`VITE_USE_MOCKS=true`) | Built |

## 7. Non-functional requirements

- **Safety:** passive collection only, verified-ownership targets only, enforced server-side. Outbound requests refuse private, loopback, and reserved addresses (`netsafety.py`). Discovery is capped at `SCAN_MAX_HOSTS` (default 50) with `SCAN_MAX_CONCURRENT_HOSTS` (3) and a per-request timeout.
- **Rate limits:** per caller, per minute: sign-up 5, sign-in 10, refresh 30, verification issue 10 / check 6, uploads 10, analysis 5, scans `SCAN_RATE_LIMIT_PER_MIN` (5). `RATE_LIMIT_SCALE` multiplies all of them for local testing; keep it at 1 in production. The limiter is in-process, so it covers one API instance.
- **Data isolation:** every project, scan, and report read checks ownership; a second account sees an empty project list.
- **Honesty:** findings are labelled potential exposure. Environment inference is labelled heuristic with a confidence. Demo data (`acme-demo.com`, `203.0.113.0/24`) is labelled synthetic. The analyst lists what it could not check.
- **Prompt safety:** collected headers and banners are untrusted input to the analyst (see [AI-AGENT.md](AI-AGENT.md)).
- **Secrets:** backend keys never in `VITE_` variables or the repo. Verification tokens are stored only as SHA-256 hashes.
- **Accessibility:** WCAG AA contrast, visible focus, keyboard-operable controls, reduced-motion support, and severity never conveyed by color alone.
- **Performance:** the landing page is interactive without a backend; fonts are self-hosted so the demo survives a weak network.
- **Print:** reports print legibly in black on white.
- **Quality gates:** 77 backend tests (pytest) + frontend typecheck, ruff, and ESLint run in CI.

## 8. Success criteria

| Criterion | Result |
|---|---|
| A judge can name the three pipeline steps after the landing page's first screen | Not yet measured (demo day) |
| One clear top priority with its evidence chain within one click | Met: the analyst ranked the single finding with evidence refs |
| A live scan of a team-owned domain completes in the time it takes to explain the product | **Met: 11 seconds** for thakardhruv.me |
| Zero requests leave the passive scope | **Met:** the scan log shows CT, DNS, and one `GET /` per host on 80/443 only |

## 9. Live validation: thakardhruv.me

Run on 2026-11-21 (7:54 PM EST) against the team-owned domain `thakardhruv.me` (hosted on Vercel, DNS at Namecheap), using a real Supabase backend and Gemini.

### Steps exercised
1. Signed up and signed in (FR-15).
2. Created project `thakardhruv.me` (FR-1, FR-2).
3. Issued a TXT challenge, added it at Namecheap, verified (FR-3).
4. Ran a scan: queued 00:54:41 UTC, completed 00:54:52 UTC (FR-4 to FR-8).
5. Ran the AI analysis and generated the report (FR-12, FR-14).
6. Uploaded the site's `package.json` (36 packages) (FR-9).

### Scan log
| Stage | Result |
|---|---|
| Certificate Transparency (crt.sh) | 1 subdomain candidate (`www`) |
| DNS | 2 of 2 hostnames resolved |
| `thakardhruv.me` | HTTP → 308 to HTTPS; HTTPS → 307 to `www` |
| `www.thakardhruv.me` | HTTP → 308 to HTTPS; HTTPS → 200 |
| HTTP/TLS metadata | collected from 2 of 2 hosts |
| Dependency intel | 0 matches (no manifest at scan time) |

### Assets
| Host | IPs | Tech | HTTPS | Env (confidence) | TLS |
|---|---|---|---|---|---|
| `thakardhruv.me` | 216.198.79.1 | Vercel | Yes, HSTS 2y | prod (low) | Let's Encrypt, trusted, expires 2027-01-25 |
| `www.thakardhruv.me` | 216.198.79.1, 64.29.17.1 (CNAME to Vercel) | Vercel | Yes, HSTS 2y | prod (low) | Let's Encrypt, trusted, expires 2027-01-23 |

`www` also sends `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, and a restrictive `Permissions-Policy`.

### Findings
| Severity | Finding | Evidence |
|---|---|---|
| Low | Content-Security-Policy header not observed | `GET https://www.thakardhruv.me/ → 200 text/html`, no CSP header |

### AI analyst (gemini-3.8-flash)
- **Summary:** one low-severity finding (missing CSP on `www`); both hosts classified prod with low confidence; dependencies not evaluated because no manifest was uploaded at scan time.
- **Priority:** P3. **Remediation:** add a CSP via `vercel.json` headers.
- **Missing evidence it reported:** no dependency manifest; low-confidence environment labels. It invented nothing beyond the collected data.

### What the test surfaced (fixed)
- **Stale local DNS blocked verification.** The campus resolver cached NXDOMAIN for the challenge name while public DNS already had the record. Verification now queries 1.1.1.1 and 8.8.8.8 directly.
- **Rate limits blocked repeated manual testing.** Added `RATE_LIMIT_SCALE` for local runs.
- **Registrar host field.** Entering the full name at Namecheap produced `…thakardhruv.me.thakardhruv.me`. The UI should say "enter `_attacksurface-challenge` as the host" (see §11).

### Not yet exercised live
- **Correlation (FR-10, FR-11):** the uploaded `package.json` was not mapped to a host, and it uses `^` ranges, which OSV can't match to an exact version. Next run: upload `package-lock.json` (or `shared/samples/vulnerable-package-lock.json`) mapped to `www.thakardhruv.me`, then rescan.
- **Attack-path graph (FR-13)** with dependency nodes, which depends on the step above.

## 10. Demo plan

- **Default:** mock mode on synthetic `acme-demo.com` fixtures. Zero risk.
- **Live:** `thakardhruv.me` is verified and has a completed scan. For a richer story, upload `shared/samples/vulnerable-package-lock.json` mapped to `www.thakardhruv.me` and rescan to show correlation, the critical minimist advisory, and a P0. Say plainly that the manifest is sample data.
- **Never** scan a judge's or third party's domain on the spot. Verification makes that impossible anyway.

## 11. Open items and risks

- **Deployment:** frontend on Vercel, backend (API + `python -m attacksurface.worker`, `RUN_JOBS_INLINE=false`) on Render/Railway/Fly; set `CORS_ORIGINS`, `FRONTEND_URL`, and Supabase Auth redirect URLs to the production domain.
- **Secrets:** rotate the Supabase service-role and Gemini keys used during development.
- **Schema:** apply the `api_docs` column (`supabase/schema.sql`) to the production database.
- **Verification UX:** show registrar-friendly host text and a "copy" button; warn that re-issuing invalidates the previous token.
- **Manifest ranges:** `package.json` with `^`/`~` ranges isn't matched; prompt for the lockfile.
- **Rate limiter** is in-process; move to Redis or a Postgres counter before running more than one API instance.
- **Environment inference** is heuristic; it is shown with a confidence and should stay that way.
- **Supabase email limits:** the built-in sender allows only a few confirmation emails per hour; configure custom SMTP before public sign-ups.
