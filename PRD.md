# AttackSurface — Product Requirements

**Status:** HackWestern 13 build · **Last updated:** 2026-11-21
Related: [PRODUCT.md](PRODUCT.md) (product truth) · [DESIGN.md](DESIGN.md) (visual system) · [ARCHITECTURE.md](ARCHITECTURE.md) · [AI-AGENT.md](AI-AGENT.md) · [shared/api-contract.md](shared/api-contract.md)

## 1. Problem

Teams don't know what an outsider can see of their infrastructure. Subdomains leak through certificate logs, staging and dev hosts stay reachable, response headers advertise versions, and vulnerable dependencies ship behind production APIs. The data exists, but it's split across tools: scanners list hosts, dependency tools list CVEs, and nobody connects the two or says what to fix first.

## 2. Product

AttackSurface builds the file an attacker would keep on you, then tells you what to fix first. Given an authorized root domain, it runs one pipeline:

1. **Discover:** passively map exposed assets from Certificate Transparency logs, DNS, and HTTP/TLS metadata.
2. **Correlate:** link each exposed host to the vulnerable dependencies running behind it, so findings form exposure paths rather than two lists.
3. **Prioritize:** an AI analyst turns findings into P0/P1 priorities with business impact and remediation.

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
- One clear P0 per scan, with the reasoning shown.
- The scope is honest and enforced: passive, authorized, potential exposure.

**Non-goals**
- Active scanning, port scanning, brute force, exploitation, or payloads of any kind.
- Scanning domains the user hasn't attested they're authorized to assess.
- Continuous monitoring, alerting, ticketing integrations, or multi-tenant billing (post-hackathon).
- Proving exploitability. Findings are potential exposure to be validated.

## 5. User stories

1. As a visitor, I can understand what AttackSurface does from the landing page and open a demo without signing up.
2. As a user, I can create a project by naming it, entering a root domain, and confirming I'm authorized.
3. As a user, I can start a scan and watch a timestamped collection log until it completes.
4. As a user, I can see every discovered host with its environment, IPs, technology, HTTPS status, and worst finding.
5. As a user, I can filter findings by severity and read each one's evidence, remediation, and analyst memo.
6. As a user, I can upload `package.json` / `package-lock.json` and see packages matched to advisories with fixed versions.
7. As a user, I can trace a host to its findings and fixes on an attack-path graph.
8. As a user, I can read a one-paragraph executive summary and a ranked "fix first" list.
9. As a user, I can export the report as Markdown or print it to PDF.

## 6. Functional requirements

Status: **Built** works end to end · **Stub** UI and API exist but return fixtures · **Planned** not started.

| ID | Requirement | Status |
|---|---|---|
| FR-1 | Create, list, and get projects; reject `authorization_confirmed=false` (HTTP 400) | Built (Supabase) |
| FR-2 | Validate `root_domain` as a registrable domain: no IPs, wildcards, schemes, paths, or ports | Built |
| FR-3 | Start a scan per project; return `scan_id`; scan states `queued → running → completed/failed` | Stub |
| FR-4 | Scan log events (`info`/`warn`/`error`) with timestamps; UI polls every 2s until complete | Stub (UI built) |
| FR-5 | Discovery: CT logs → hostnames; DNS → IPs; HTTP/TLS → headers, server, certificate expiry | Planned (`discovery/`) |
| FR-6 | Environment inference per host (`prod`/`staging`/`dev`/`unknown`) | Planned |
| FR-7 | Rule findings: missing HSTS/CSP/X-Frame-Options/Permissions-Policy, no HTTPS redirect, version disclosure, cert expiring, non-prod reachable | Planned (fixtures model them) |
| FR-8 | Dependency upload (`package.json`, `package-lock.json`) → packages, direct vs transitive | Stub |
| FR-9 | OSV advisory matching with severity and fixed version | Planned (`intel/`) |
| FR-10 | **Correlation:** link each manifest to the host it's deployed on | **Gap:** no host field on upload today |
| FR-11 | AI analysis: executive summary plus per-finding memo with priority, impact, confidence, and evidence refs | Stub (see [AI-AGENT.md](AI-AGENT.md)) |
| FR-12 | Attack-path graph: root → host → finding → fix | Stub (UI built) |
| FR-13 | Markdown report per scan; Markdown export and print-to-PDF | Stub (UI built) |
| FR-14 | Mock mode: every page works from `shared/fixtures` with no backend | Built |
| FR-15 | Sign-up / sign-in | WIP (placeholder routes) |

## 7. Non-functional requirements

- **Safety:** passive collection only, authorized targets only, enforced server-side. Rate limit scans (`SCAN_RATE_LIMIT_PER_MIN`, default 30).
- **Honesty:** findings are labelled potential exposure. Demo data (`acme-demo.com`, `203.0.113.0/24`) is labelled synthetic. No invented customers, metrics, or claims.
- **Secrets:** backend keys never in `VITE_` variables or the repo.
- **Accessibility:** WCAG AA contrast, visible focus, keyboard-operable controls, reduced-motion support, and severity never conveyed by color alone.
- **Performance:** the landing page is interactive without a backend; fonts are self-hosted so the demo survives a weak network.
- **Print:** reports print legibly in black on white.

## 8. Success criteria

Targets for the demo, not measured results:
- A judge can name the three pipeline steps after the landing page's first screen.
- The demo dashboard shows a single P0 with its evidence chain within one click of the landing page.
- A live scan of a team-owned domain completes in the time it takes to explain the product.
- Zero requests leave the passive scope (no port scans, no payloads).

## 9. Demo plan

- **Default:** mock mode on synthetic `acme-demo.com` fixtures. Zero risk.
- **Stretch:** a live scan of a domain the team owns, seeded with staging/dev subdomains, missing headers, a plain-HTTP dev host, and an API manifest pinning a vulnerable package. Keep mock mode one env var away as a fallback.
- **Never** scan a judge's or third party's domain on the spot.

## 10. Open questions and risks

- **Manifest ↔ host link (FR-10):** the "correlate" claim depends on it. Proposed: a "deployed on" host selector at upload, stored as `asset_id` on dependencies.
- **Auth model:** whether the demo needs auth at all; the current routes are placeholders.
- **Environment inference** from hostnames is heuristic; it should be marked as inferred.
- **LLM reliability:** analysis must validate against the schema and fall back to deterministic ranking (see AI-AGENT.md).
- **Backend config:** the backend fails to import without `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, and `JWT_SECRET`, which affects CI and local tests.
