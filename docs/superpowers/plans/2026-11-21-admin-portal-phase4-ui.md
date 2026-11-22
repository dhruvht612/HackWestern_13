# Admin Portal Phase 4 (Admin UI) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The admin portal screens: a guarded `/admin` area with Review Queue, Users, Domains, Overview, Abuse Feed, Blocklist, and Audit Log. They work fully in demo mode on labelled sample data, and call the real `/admin/*` API in real mode.

**Architecture:** One typed contract (`src/lib/types.ts`, pinned to ADMIN-PANEL.md §9) feeds `api.admin.*` methods. In demo mode those methods serve `shared/fixtures/admin/*.json` through an in-memory copy, so approve, reject, and suspend visibly change state for the demo. In real mode they call FastAPI. `/admin/me` and suspend/unsuspend exist today; the other endpoints arrive in Phase 3 and show an honest "not available yet" until then. `RequireAdmin` gates the routes in the UI; FastAPI stays the authority. One shared `ReasonForm` handles every mutation.

**Tech Stack:** React 19, React Router 7, TanStack Query 5, Tailwind (DESIGN.md tokens), lucide-react, existing components (`DataTable`, `DetailPanel`, `EvidenceBlock`, `SeverityBadge`, `PageHeader`, `EmptyState`, `PageSkeleton`).

**Spec:** [`ADMIN-PANEL.md`](../../../ADMIN-PANEL.md) §2 (policies), §8 (roles), §9 (API), §10 (frontend), §11 Phase 4.

## Global Constraints

- FastAPI is the authority; the UI guard is convenience only. Non-admins see the 404 page, never "forbidden", so the portal's existence isn't advertised.
- Every mutation needs a reason: trimmed, at least 5 characters, max 500. The button stays disabled until the reason is valid.
- Gemini output is labelled advice ("Gemini recommends …"), never shown as a decision. The no-self-review rule is mirrored in the UI: an item whose `user_id` is the admin's own id has no Approve/Reject buttons.
- `viewer` sees no mutation controls; `operator` does.
- Demo mode is visibly distinct: a "Sample data" band on every admin page. Real mode never falls back to fixtures.
- Fixture domains use reserved names only (`.test`, `.example`, `example.com`). No real bank or brand names.
- Visual system per DESIGN.md: Attacker's Dossier type, square corners, ledgers, `tab` / `sheet` / `btn-*` / `field` classes, existing colour tokens only. Severity is never shown by colour alone (labels stay).
- Accessibility: every control is keyboard-operable, inputs have labels, status changes use `role="status"` / `role="alert"`.
- No new npm dependencies.

**Ruling recorded here:** the frontend has no test runner, and adding one is a new dependency. So each task's gate is `npm run typecheck && npm run lint && npm run build` plus a scripted browser check in demo mode. This replaces RED/GREEN unit tests for UI tasks. Cost if wrong: UI logic regressions get caught by eye, not by a test.

## Review Focus

1. **A reason of only whitespace, or 4 characters:** the submit stays disabled, and the server's 422 message is shown if it gets through anyway. Covered in Task 1 (`ReasonForm`).
2. **A real-mode endpoint returning 404 (not built yet) or 403 (role lost mid-session):** the page shows "Not available yet" / redirects to the 404 page, never a blank screen or a crash. Task 2.
3. **A decision on an item someone else already decided (server 409):** show "Already decided by someone else", refetch, and keep the panel open. Task 3.
4. **A long domain or email** (e.g. 60-character IDNA labels) must not break the table layout at a 375px width. Covered in each page's browser check.
5. **An operator viewing their own pending review:** no decision buttons, with an explanatory line. Task 3.

---

### Task 1: Admin contract, API methods, fixtures, `ReasonForm`

**Files:**
- Modify: `src/lib/types.ts`, `src/lib/api.ts`
- Create: `shared/fixtures/admin/{me,overview,reviews,users,domains,events,blocklist,audit}.json`, `src/mocks/adminFixtures.ts`, `src/components/admin/ReasonForm.tsx`

**Interfaces (produced):**
```ts
type AdminRole = "viewer" | "operator";
type RiskLevel = "low" | "medium" | "high";
interface AdminMe { id: string; email: string | null; role: AdminRole; aal: "aal1" | "aal2"; mfa_required: boolean }
interface AdminOverview { users: number; verified_domains: number; pending_reviews: number; scans_24h: number;
  scan_failures_24h: number; blocklist_hits_24h: number; ai_fallback_rate: number | null;
  worker_last_seen: string | null; daily_brief: { text: string; source: "gemini" | "template" } }
interface AiVerdict { recommendation: "approve" | "reject" | "needs_more_info"; confidence: "low" | "medium" | "high";
  summary: string; key_signals: string[]; missing_information: string[]; model: string | null; fallback_used: boolean }
interface ReviewSignal { id: string; label: string; value: string }
interface ReviewItem { id: string; kind: "user" | "domain"; status: "pending" | "approved" | "rejected";
  risk_level: "medium" | "high"; user_id: string; user_email: string | null; project_id: string | null;
  root_domain: string | null; signals: ReviewSignal[]; ai_verdict: AiVerdict | null; created_at: string;
  decided_by: string | null; decided_at: string | null; decision_reason: string | null }
interface AdminUserRow { id: string; email: string | null; status: "active" | "pending_review" | "suspended";
  risk_level: RiskLevel; risk_reasons: string[]; created_at: string; last_seen: string | null; projects: number }
interface AdminDomain { project_id: string; root_domain: string; owner_id: string; owner_email: string | null;
  dns_proof: "unverified" | "pending" | "verified" | "expired";
  authorization: "not_routed" | "auto_cleared" | "pending_review" | "approved" | "rejected" | "revoked";
  verified_at: string | null; risk_level: RiskLevel | null }
interface SecurityEvent { id: number; type: string; user_id: string | null; user_email: string | null;
  ip: string | null; subject: string | null; detail: Record<string, unknown>; created_at: string }
interface BlocklistEntry { pattern: string; match: "exact" | "suffix"; reason: string; created_at: string }
interface AuditEntry { id: number; actor_id: string | null; actor_email: string | null; action: string;
  target_type: string; target_id: string; reason: string | null; created_at: string }
interface Page<T> { items: T[]; next_cursor: string | null }
```
- `api.admin`:
  - `me()`, `overview()`
  - `reviews(params?: { status?; kind? })`, `review(id)`, `decide(id, decision: "approve" | "reject", reason)`, `reanalyze(id)`
  - `users(params?: { q?; status?; risk? })`, `suspend(id, reason)`, `unsuspend(id, reason)`
  - `domains(params?: { status? })`, `revoke(projectId, reason)`, `recheck(projectId)`
  - `events(params?: { type? })`, `blocklist()`, `addBlock(pattern, match, reason)`, `removeBlock(pattern, reason)`, `audit(params?: { action? })`
  - Lists return `Page<T>`. Paths and methods are exactly ADMIN-PANEL.md §9. `removeBlock` is `DELETE /admin/blocklist?pattern=…` with a JSON `{reason}` body.
- `adminFixtures.ts` exports `adminStore`, a mutable deep copy of the fixtures, plus pure helpers that apply decide/suspend/revoke/block changes to it and append an `AuditEntry` (actor = the fixture `me`). This lets the demo show the full loop.
- `ReasonForm({ label, submitLabel, tone: "danger" | "primary", onSubmit(reason): Promise<void> })`:
  - a `<textarea>` with a visible label and a "5+ characters" hint;
  - submit disabled until `reason.trim().length >= 5`, max 500;
  - shows `ApiError.message` inline (`role="alert"`) and keeps the text on error.

**Fixture content (demo story):**
- `me`: operator, `aal2`.
- `reviews`:
  1. high, domain `examplebank.test`, `test-account-02@example.com`, 5 claims in 1 hour, Gemini `needs_more_info` (medium), missing "Evidence of authority to claim the domains";
  2. medium, user `j.doe@proton.example`, `ip_accounts_24h = 3` plus a NAT caveat, Gemini `needs_more_info` (low);
  3. high, domain `agency.gov.test`, `sensitive_tld`, Gemini `approve` (medium) because the email domain matches;
  4. one already-rejected item, for history.
- `users`: 5 users, including the fixture admin (`you@example.com`), one suspended, one `pending_review`.
- `domains`: `thakardhruv.me` (approved, legacy), `examplebank.test` (pending_review), one auto_cleared, one revoked.
- `events`: about 12 events mixing `signup`, `verify_failed`, `blocklist_hit`, `rate_limited`, `scan_started`.
- `blocklist`: `bank.test` (suffix), `gov.test` (suffix).
- `audit`: 3 entries, including `migration.approve_legacy_dns`.

- [ ] **Step 1:** Write the types, fixtures, `adminFixtures.ts`, the `api.admin` methods, and `ReasonForm`.
- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm run build`. Expected: pass.
- [ ] **Step 3: Commit** `Add admin portal contract, API client, demo fixtures, and reason form`.

---

### Task 2: `RequireAdmin`, `AdminLayout`, routes, entry link

**Files:**
- Create: `src/components/admin/RequireAdmin.tsx`, `src/layouts/AdminLayout.tsx`, `src/components/admin/AdminState.tsx`
- Modify: `src/router.tsx`, `src/components/AccountMenu.tsx`

**Interfaces:**
- `RequireAdmin`: `useQuery(["admin", "me"], api.admin.me, { retry: false })`.
  - Loading → `PageSkeleton`.
  - `ApiError` 401/403/404 → `<NotFoundPage />`.
  - Error message containing "two-factor" → a panel linking to `/account/security`.
  - Success → `<Outlet context={me} />`.
  - Exported hook: `useAdmin(): AdminMe` (via `useOutletContext`).
- `AdminLayout`:
  - the `ClassificationBand` "Admin // Every action is logged";
  - in demo mode a second band "Sample data, not real users";
  - a header with an "Admin" label, the role badge (`operator` / `viewer`), "MFA ✓" when `aal2`, a link back to Projects, and `AccountMenu`;
  - `tab` nav: Review queue (with the pending count) · Users · Domains · Overview · Abuse feed · Blocklist · Audit log;
  - `<main className="sheet">`.
- `AdminState({ query })`: renders loading / error / empty consistently. A 404 → "This part of the admin API isn't available yet (Phase 3)." Any other error → its message.
- Routes under `RequireAuth` → `RequireAdmin` → `AdminLayout`: `/admin` (index → Review queue), `/admin/users`, `/admin/domains`, `/admin/overview`, `/admin/events`, `/admin/blocklist`, `/admin/audit`.
- `AccountMenu` shows an "Admin" link only when `useQuery(["admin", "me"])` succeeded (`retry: false`, errors silenced). In demo mode it always shows.

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Run** typecheck, lint, build. Expected: pass.
- [ ] **Step 3: Browser check (demo mode):** `/admin` renders the layout, both bands, and the tabs; every tab route renders (a placeholder is fine until Tasks 3–7); `/admin/nonsense` → 404.
- [ ] **Step 4: Commit** `Add admin route guard, layout, and navigation`.

---

### Task 3: Review queue

**Files:** Create `src/pages/admin/ReviewQueuePage.tsx`; route it as the `/admin` index.

**Behaviour:**
- A filter tablist: Pending (default) · Decided · All.
- The list is sorted high → medium, then oldest first. Each row shows:
  - a risk label (`SeverityBadge` with high → `high`, medium → `medium`);
  - the kind;
  - the target (`root_domain` or `user_email`, mono, truncating);
  - the requester's email;
  - the Gemini one-liner: recommendation + confidence + summary, prefixed "Gemini recommends"; "Rules only" when `fallback_used`;
  - the age.
- The detail panel (the `DetailPanel` split, like FindingsPage) shows:
  - signals as a definition list (`label: value`), with each signal's `id` in mono;
  - the Gemini block: recommendation, confidence, summary, a `key_signals` list where each ID links to its signal row by anchor, the missing information, and the model name, or "Rules-only fallback";
  - for pending items an operator can decide: two `ReasonForm`s (Approve = primary, Reject = danger);
  - for a viewer: "Viewers can't decide reviews.";
  - for an item about themselves: "You can't decide a review about your own account or domains." (Review Focus 5);
  - decided items: who, when, and why.
- On success: invalidate `["admin"]`, show `role="status"` "Approved" / "Rejected", and move to the next pending item. On 409: "Someone else already decided this.", refetch, and keep the panel (Review Focus 3).

- [ ] **Step 1:** Implement.
- [ ] **Step 2: Run** typecheck, lint, build. Expected: pass.
- [ ] **Step 3: Browser check (demo mode):**
  1. 3 pending items, high first.
  2. Open `examplebank.test` → signals and Gemini advice visible.
  3. A 4-character reason keeps Reject disabled.
  4. Reject with "No proof of authority" → the item leaves Pending and appears under Decided, and the Audit log tab shows the entry.
  5. A 375px screenshot has no horizontal overflow of the page.
- [ ] **Step 4: Commit** `Add admin review queue`.

---

### Task 4: Users

**Files:** Create `src/pages/admin/UsersPage.tsx`.

**Behaviour:**
- A search field (email contains, client-side in demo mode, the `q` param in real mode), a status filter (All / Active / Under review / Suspended), and a risk filter.
- A `DataTable`: email, status label, risk label, risk reasons (comma list, truncated), projects, joined, last seen.
- The detail panel: profile and risk reasons, then a `ReasonForm`:
  - "Suspend" (danger) for active or pending users;
  - "Restore access" (primary) for suspended users.
  - Hidden for your own row ("This is you.") and for viewers.
  - Success → `role="status"` with the new status; invalidate `["admin"]`.

- [ ] **Step 1:** Implement. **Step 2:** typecheck, lint, build pass.
- [ ] **Step 3: Browser check:** suspend a user with a reason → the status shows Suspended and the audit entry appears; your own row has no suspend form.
- [ ] **Step 4: Commit** `Add admin users page`.

---

### Task 5: Domains

**Files:** Create `src/pages/admin/DomainsPage.tsx`.

**Behaviour:**
- A filter by authorization state.
- A `DataTable`: domain (mono), owner email, DNS proof label, authorization label, verified date, risk.
- Labels (text, never colour alone):
  - `not_routed` → "Not routed (can't scan)"
  - `auto_cleared` → "Auto-cleared"
  - `pending_review` → "Under review"
  - `approved` → "Approved"
  - `rejected` → "Rejected"
  - `revoked` → "Revoked"
- The detail panel:
  - a "Re-check DNS" button (operator) → shows "Record found" / "Record not found" from the response;
  - a `ReasonForm` "Revoke authorization" (danger, operator) for scan-eligible domains, with the warning "Stops queued and running scans for this domain."

- [ ] **Step 1:** Implement. **Step 2:** typecheck, lint, build pass.
- [ ] **Step 3: Browser check:** revoke `thakardhruv.me` in demo mode → it shows Revoked, plus the audit entry.
- [ ] **Step 4: Commit** `Add admin domains page`.

---

### Task 6: Overview

**Files:** Create `src/pages/admin/OverviewPage.tsx`.

**Behaviour:**
- Stat tiles in a ledger row: users, verified domains, pending reviews (links to the queue), scans 24h, scan failures 24h, blocklist hits 24h, AI fallback rate (`—` when null).
- A worker heartbeat line: "Worker last seen 2 min ago", or "No worker heartbeat" (warning label).
- The daily brief as a `sheet` block, with its source label "Written by Gemini" / "Template".
- Tiles use text and numbers; no charts.

- [ ] **Step 1:** Implement. **Step 2:** typecheck, lint, build pass.
- [ ] **Step 3: Browser check:** tiles render at 375px without overflow.
- [ ] **Step 4: Commit** `Add admin overview`.

---

### Task 7: Abuse feed, Blocklist, Audit log

**Files:** Create `src/pages/admin/EventsPage.tsx`, `BlocklistPage.tsx`, `AuditPage.tsx`.

**Behaviour:**
- **Events:**
  - a type filter;
  - a `DataTable` with time, type label, user email (or "—"), IP (mono), subject (mono), and detail (compact `key: value`);
  - `blocklist_hit` and `verify_failed` rows marked with a text tag ("Blocklist", "Failed check").
- **Blocklist:**
  - a table (pattern mono, match, reason, added);
  - an operator "Add pattern" form: a pattern field, an `exact` / `suffix` radio with a one-line explanation ("suffix blocks the domain and every subdomain; never partial words"), and a `ReasonForm`;
  - "Remove" per row opens a `ReasonForm` in the detail panel.
- **Audit:**
  - an action filter;
  - a read-only `DataTable` with time, actor (email, or "System" when `actor_id` is null), action (mono), target, and reason;
  - a note: "Entries can't be edited or deleted."

- [ ] **Step 1:** Implement. **Step 2:** typecheck, lint, build pass.
- [ ] **Step 3: Browser check:** add the `example.test` suffix block → it appears in Blocklist and Audit; the Events filter narrows rows.
- [ ] **Step 4: Commit** `Add admin abuse feed, blocklist, and audit log`.

---

## Self-review notes

- **Spec §10 pages 1–7** → Tasks 3–7 (order: Review, Users, Domains, Overview, Abuse, Blocklist, Audit).
- **Mock fixtures** → Task 1.
- **`RequireAdmin` + layout** → Task 2.
- **Left out:** user-side states for pending/rejected/revoked. They depend on Phase 2's state machine.
- **Left out:** pages 8–9 (Gemini Operations, Copilot), which are Phase 5.
- **Keyboard, mobile, and contrast** are checked in each browser step.
