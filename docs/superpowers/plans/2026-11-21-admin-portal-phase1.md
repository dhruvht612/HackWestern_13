# Admin Portal Phase 1 (Secure Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The secure base the rest of the admin portal stands on: admin tables and an append-only audit log, account status checked on every request, admin role and MFA enforcement, security-event logging, one atomic audited admin action (suspend/unsuspend) with Auth-ban reconciliation, and TOTP enrolment.

**Architecture:** Schema changes are appended to the idempotent `supabase/schema.sql`, which is applied to existing databases by re-running it (the repo's existing migration path). The atomic admin write is a `plpgsql` function called with `db.rpc(...)`, because PostgREST can't run multi-statement transactions. FastAPI enforces every check itself: the backend uses the service role, so RLS is bypassed. MFA calls Supabase GoTrue's REST API with the user's own access token, behind an injectable dependency so tests don't touch the network.

**Tech Stack:** FastAPI, supabase-py (PostgREST + GoTrue), httpx, PyJWT, pytest with the in-memory `tests/fakes.py`, Postgres/plpgsql on Supabase, React + TanStack Query + Vite.

**Spec:** [`ADMIN-PANEL.md`](../../../ADMIN-PANEL.md), §2 (policies), §3.2 (repo corrections), §4 (data model), §8 (access control), §11 Phase 1.

## Global Constraints

- All production admin access requires Supabase `aal = "aal2"`. `ADMIN_REQUIRE_MFA` defaults to `true` when `APP_ENV=production` and is read only from the server environment.
- Fail closed: a missing `user_status` row, a `suspended` status, or an exception during the status/role lookup denies the request.
- Admin roles are exactly `viewer` and `operator`; `operator` ⊇ `viewer`. The role is read from `admin_users` on every admin request.
- Reasons for admin writes: at least 5 non-space characters after trimming.
- No self-action: an operator can't suspend or unsuspend themselves.
- Decision state change, audit row, and outbox row commit in one transaction (one `plpgsql` function).
- `admin_audit_log` is append-only for application roles: `UPDATE` and `DELETE` raise.
- Admin rate limits: reads 60/min, writes 20/min per admin (multiplied by `RATE_LIMIT_SCALE`).
- Schema changes are additive and idempotent; nothing is dropped or reset. New tables: RLS enabled, `service_role` full access, `anon` and `authenticated` revoked. New functions: `execute` revoked from `public, anon, authenticated`, granted to `service_role` only.
- The service-role key never reaches the browser; no `VITE_` variable carries a secret.
- Security-event writes must never fail the request that triggered them.
- `make test` and `make lint` pass at the end of every task.

**Deviation from ADMIN-PANEL.md §4, decided here:** no separate `supabase/migrations/` file. `schema.sql` is already idempotent and documented as safe to re-run on existing databases, so a second copy would only drift. `admin_audit_log.actor_id` is nullable: `null` means the system or migration actor, which backfill rows need.

## Review Focus

1. **A user with a valid token but no `user_status` row** (trigger missed, dashboard-created account) should get 403 "Account setup incomplete", not a 500. Test in Task 3.
2. **The `security_events` table missing, or the DB erroring on insert,** must not break sign-up, sign-in, or verification. Test in Task 4.
3. **An operator whose `admin_users` row is deleted mid-session** should be denied on the next request, even with the same token. Test in Task 5.
4. **An operator targeting themselves** (suspend own account) should get 403 before the RPC is called. Test in Task 5.
5. **A wrong TOTP code, or GoTrue being unreachable,** should give 400 "Invalid code" / 502 and leave the stored session untouched. Tests in Task 7 (backend) and Task 8 (frontend keeps the old session on error).

---

### Task 1: Schema — admin tables, triggers, backfills, `admin_set_user_status`

**Files:**
- Modify: `supabase/schema.sql` (append a new `-- Admin portal` section after the Privileges section)
- Create: `supabase/tests/admin_portal_selftest.sql`
- Modify: `backend/README.md` (an "Admin bootstrap" section)

**Interfaces:**
- Produces tables: `admin_users`, `user_status`, `review_items`, `security_events`, `domain_blocklist`, `admin_audit_log`, `auth_outbox`, `ai_admin_runs`, and the `projects` columns `review_status`, `risk_level`, `risk_reasons`, `authorization_revoked_at`, `revoked_reason`. Columns exactly as ADMIN-PANEL.md §4.1, with these specifics:
  - `admin_audit_log.actor_id uuid null references auth.users(id)` (`null` = system)
  - `domain_blocklist.match text not null check (match in ('exact','suffix'))`
  - `auth_outbox(id bigserial pk, user_id uuid not null references auth.users(id) on delete cascade, action text check (action in ('ban','unban')), status text not null default 'pending' check (status in ('pending','done','failed')), attempts int not null default 0, last_error text, created_at timestamptz default now(), done_at timestamptz)`
  - `review_items`: check `(kind = 'domain') = (project_id is not null)`; a partial unique index on `(kind, coalesce(project_id, user_id)) where status = 'pending'`.
- Produces function `public.admin_set_user_status(p_actor uuid, p_target uuid, p_status text, p_reason text, p_ip text) returns jsonb` → `{"user_id", "status", "previous_status"}`.
- Produces trigger `on_auth_user_created` (after insert on `auth.users`) → inserts `user_status(user_id, status 'active', risk_level 'low', status_reason 'signup')` on conflict do nothing. The function is `security definer` with `set search_path = public`.
- **Error contract** (raised with `raise exception '<code>'`; Task 5 maps these):

  | Message | When |
  |---|---|
  | `reason_too_short` | `length(btrim(p_reason)) < 5` |
  | `invalid_status` | `p_status not in ('active','suspended')` |
  | `self_action` | `p_actor = p_target` |
  | `not_operator` | no `admin_users` row with `role = 'operator'` for `p_actor` |
  | `not_found` | no `user_status` row for `p_target` |

- [ ] **Step 1: Write the self-test** `supabase/tests/admin_portal_selftest.sql`: one `begin; … rollback;` script with `do $$ … $$` blocks that `raise exception 'FAIL: …'` on any failed assertion and `raise notice 'PASS: …'` otherwise. It inserts two `auth.users` rows (`id, email, aud, role` = `'authenticated'`) and asserts:
  - `admin_selftest_trigger`: each new auth user has a `user_status` row with `status = 'active'`.
  - `admin_selftest_suspend`: with an operator actor, `admin_set_user_status(op, target, 'suspended', 'abuse test', '127.0.0.1')` returns `status = 'suspended'`, `previous_status = 'active'`, writes exactly one `admin_audit_log` row (`action = 'user.suspend'`, `target_id = target::text`), and exactly one `auth_outbox` row (`action = 'ban'`, `status = 'pending'`).
  - `admin_selftest_unsuspend`: unsuspending writes `action = 'user.unsuspend'` and an outbox `unban`.
  - `admin_selftest_rollback`: for each error code in the contract, call inside a `begin … exception when others` block; assert `sqlerrm` equals the code **and** that the `admin_audit_log`, `auth_outbox`, and `user_status` counts are unchanged.
  - `admin_selftest_append_only`: `update admin_audit_log set reason = 'x'` and `delete from admin_audit_log` each raise `admin_audit_log is append-only`.
  - `admin_selftest_grants`: `has_function_privilege('anon', 'admin_set_user_status(uuid,uuid,text,text,text)', 'execute')` and the same for `authenticated` are false.
  - `admin_selftest_backfill`: a project with `verified_at` set and `verification_method = 'dns-txt'` (inserted with `review_status = 'none'` before re-running the backfill statement) ends `approved` with one audit row `action = 'migration.approve_legacy_dns'`.

- [ ] **Step 2: Paste the self-test into the Supabase SQL editor before applying the schema.**
  Expected: FAIL (`relation "admin_users" does not exist`, or similar).

- [ ] **Step 3: Append the admin section to `supabase/schema.sql`:** the tables and columns above; indexes `security_events (created_at desc)`, `security_events (user_id, created_at desc)`, `review_items (status, created_at)`; the audit trigger (`admin_audit_log_immutable()`, `before update or delete`); the `on_auth_user_created` trigger; and `admin_set_user_status`. The function body:
  1. validates in contract order (reason, status, self, operator);
  2. `select status into v_prev from user_status where user_id = p_target for update` (not found → `not_found`);
  3. updates `user_status` (`status`, `status_reason = p_reason`, `updated_at = now()`);
  4. if the status changed, inserts `auth_outbox` (`ban` for suspended, `unban` for active);
  5. inserts `admin_audit_log(actor_id, action, target_type 'user', target_id, reason, detail {"from","to"}, ip)` with action `user.suspend` / `user.unsuspend`;
  6. returns the jsonb.

  Then the backfills, all idempotent:
  - `insert into user_status (user_id, status, risk_level, status_reason) select id, 'active', 'low', 'migration backfill' from auth.users on conflict do nothing`;
  - `with upd as (update projects set review_status = 'approved' where review_status = 'none' and verified_at is not null and verification_method = 'dns-txt' returning id) insert into admin_audit_log (actor_id, action, target_type, target_id, reason) select null, 'migration.approve_legacy_dns', 'project', id::text, 'pre-portal DNS verification' from upd`.

  Then RLS, grants, and the function revoke/grant per Global Constraints.

- [ ] **Step 4: Apply `schema.sql` in the SQL editor twice** (idempotency), then run the self-test.
  Expected: every block prints `PASS: …`, no `FAIL`, and the script ends with `ROLLBACK`.

- [ ] **Step 5: Add "Admin bootstrap" to `backend/README.md`:** re-apply `supabase/schema.sql`, run `supabase/tests/admin_portal_selftest.sql`, then make the first operator:
  ```sql
  insert into admin_users (user_id, role) select id, 'operator' from auth.users where email = '<operator email>';
  ```
  then enrol MFA at `/account/security` (Task 8).

- [ ] **Step 6: Commit**
  ```bash
  git add supabase/schema.sql supabase/tests/admin_portal_selftest.sql backend/README.md
  git commit -m "Add admin portal schema: roles, user status, audit log, outbox, suspend function"
  ```

---

### Task 2: Settings and client IP

**Files:**
- Modify: `backend/attacksurface/config.py` (`Settings`, `settings_from_env`)
- Create: `backend/attacksurface/netinfo.py`
- Modify: `.env.example`, `backend/tests/conftest.py` (env block: `"ADMIN_REQUIRE_MFA": "false"`, `"TRUSTED_PROXY_COUNT": "0"`)
- Test: `backend/tests/test_config.py`, `backend/tests/test_security.py`

**Interfaces:**
- Produces `Settings.admin_require_mfa: bool` (env `ADMIN_REQUIRE_MFA`; default `app_env == "production"`) and `Settings.trusted_proxy_count: int` (env `TRUSTED_PROXY_COUNT`, default 0, clamped ≥ 0).
- Produces `netinfo.client_ip(request: Request) -> str | None`. With `trusted_proxy_count = n > 0`, it returns the n-th address from the right of `X-Forwarded-For` (falling back to the socket address if the header has fewer than n entries). With `n = 0` it ignores the header and returns `request.client.host`.

- [ ] **Step 1: Write failing tests**
  - `test_admin_require_mfa_defaults`: `settings_from_env({"APP_ENV": "production"}).admin_require_mfa is True`; `settings_from_env({"APP_ENV": "development"}).admin_require_mfa is False`; `settings_from_env({"APP_ENV": "production", "ADMIN_REQUIRE_MFA": "false"}).admin_require_mfa is False`.
  - `test_client_ip_ignores_forwarded_without_trusted_proxy`: header `X-Forwarded-For: 6.6.6.6` with socket `10.0.0.1` and n=0 → `"10.0.0.1"`.
  - `test_client_ip_trusted_proxy`: header `"1.1.1.1, 2.2.2.2"`, n=1 → `"2.2.2.2"`; n=2 → `"1.1.1.1"`; n=3 → socket address.
  Build the `Request` via `starlette.requests.Request({"type": "http", "headers": [...], "client": ("10.0.0.1", 1)})`; pass n as an argument or monkeypatch `settings.trusted_proxy_count`.

- [ ] **Step 2: Run** `uv run --project backend --locked pytest backend/tests/test_config.py backend/tests/test_security.py -q`. Expected: FAIL (`AttributeError` / `ModuleNotFoundError`).

- [ ] **Step 3: Implement** the settings and `client_ip`. Add to `.env.example`, under the rate-limit block:
  ```
  # Admin portal. MFA for admin routes defaults to on in production; never disable it there.
  ADMIN_REQUIRE_MFA=
  # Number of reverse proxies in front of the API whose X-Forwarded-For you trust (0 = ignore the header).
  TRUSTED_PROXY_COUNT=0
  ```

- [ ] **Step 4: Run** `make test` and `make lint`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -am "Add admin MFA and trusted-proxy settings"` (plus `git add backend/attacksurface/netinfo.py`).

---

### Task 3: Account status on every request (fail closed), `aal` on the user, fake `rpc`

**Files:**
- Modify: `backend/attacksurface/jwt.py` (`CurrentUser`, `get_current_user`)
- Modify: `backend/tests/fakes.py` (`FakeSupabase.rpc`)
- Modify: `backend/tests/conftest.py` (the `db` fixture seeds `user_status` for `USER_A`, `USER_B`)
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Produces `CurrentUser(id: str, email: str | None, aal: str = "aal1", status: str = "active")`.
- `get_current_user(credentials, db=Depends(get_db)) -> CurrentUser`. After decoding the token, it reads `user_status` by `user_id`:
  - no row → 403 `"Account setup incomplete. Contact support."`
  - `suspended` → 403 `"This account is suspended."`
  - any exception from the lookup → 403 `"Account status unavailable."`
  - `aal` from `claims.get("aal", "aal1")`.
- Produces `FakeSupabase.rpc(name: str, params: dict) -> _RpcCall` whose `.execute()` returns `_Resp([result])`, where `result = self.rpc_handlers[name](params)`. A handler may raise `postgrest.exceptions.APIError({"message": "<code>", "code": "P0001"})`. An unregistered name raises `KeyError`. `FakeSupabase.rpc_calls: list[tuple[str, dict]]` records calls.
- Conftest `db` fixture: `db.table("user_status").insert([{"user_id": USER_A, "status": "active", "risk_level": "low"}, {"user_id": USER_B, …}]).execute()`.

- [ ] **Step 1: Write failing tests** in `test_auth.py`:
  - `test_me_reports_status_and_aal`: `GET /auth/me` with `make_token(aal="aal2")` → 200, `status == "active"`, `aal == "aal2"`. (`AuthUser` gains `status: str` and `aal: str`; update `schemas.py`.)
  - `test_suspended_user_blocked_everywhere`: set USER_A's status to `suspended` in the fake → `GET /auth/me` and `GET /projects` both 403 `"This account is suspended."`.
  - `test_missing_status_row_fails_closed` (Review Focus 1): token for a new UUID with no row → `GET /projects` returns 403 `"Account setup incomplete. Contact support."`.
  - `test_status_lookup_error_fails_closed`: monkeypatch the fake's `table` to raise for `user_status` → 403 `"Account status unavailable."`.

- [ ] **Step 2: Run** `uv run --project backend --locked pytest backend/tests/test_auth.py -q`. Expected: FAIL.

- [ ] **Step 3: Implement** the `get_current_user` change, `AuthUser` fields, `/auth/me` returning them, and `FakeSupabase.rpc` with the conftest seeding.

- [ ] **Step 4: Run** `make test`. Expected: all pass, including every pre-existing test (seeding keeps USER_A and USER_B active).

- [ ] **Step 5: Commit** `git commit -am "Check account status on every request and fail closed"`

---

### Task 4: Security events

**Files:**
- Create: `backend/attacksurface/events.py`
- Modify: `backend/attacksurface/routers/auth.py` (sign-up, sign-in), `backend/attacksurface/routers/projects.py` (issue/check verification, create scan), `backend/attacksurface/ratelimit.py` (hook), `backend/attacksurface/main.py` (register the hook)
- Test: `backend/tests/test_events.py`

**Interfaces:**
- Produces `events.record(db: Any, type: str, *, user_id: str | None = None, ip: str | None = None, subject: str | None = None, detail: dict | None = None) -> None`. It inserts into `security_events`, swallows every exception, and logs it with `logging.getLogger("attacksurface.events").warning`.
- `type` is one of: `signup`, `signin_failed`, `verify_issued`, `verify_failed`, `verify_passed`, `rate_limited`, `scan_started` (the other §4 types arrive in Phases 2–3).
- Produces `RateLimiter.on_limited: Callable[[str], None] | None = None`, called with the key just before the 429 is raised. Exceptions from the hook are swallowed.
- `main.py` sets `limiter.on_limited = events.record_rate_limited`. `events.record_rate_limited(key: str) -> None` splits `key` at the first `:` into `subject` (action) and the remainder. If the remainder parses as a UUID it becomes `user_id`, otherwise `ip`. It writes through `events.get_db()`, a module-level reference to `database.get_db` that tests monkeypatch.
- The `/auth/signup` and `/auth/signin` handlers gain `db: Any = Depends(get_db)` and use `netinfo.client_ip(request)` for `ip`.

- [ ] **Step 1: Write failing tests** in `test_events.py`:
  - `test_signup_records_event`: successful signup → one `security_events` row, `type == "signup"`, `subject == <email domain only>` (no full email).
  - `test_failed_signin_records_event`: wrong password → 401 and one `signin_failed` row with `subject == <email domain>`.
  - `test_verification_events`: issuing → `verify_issued`; a non-matching check → `verify_failed`; a matching check → `verify_passed` (reuse the DNS monkeypatch already in `test_projects.py`).
  - `test_scan_start_records_event`: `POST /projects/{id}/scans` on a verified project → `scan_started`.
  - `test_rate_limited_records_event`: exceed the sign-in limit → the last call is 429 and a `rate_limited` row exists with `subject == "signin"` and `ip` set, `user_id` null.
  - `test_event_failure_never_breaks_request` (Review Focus 2): make the fake raise on `table("security_events")` → sign-up still returns 201.

- [ ] **Step 2: Run** `uv run --project backend --locked pytest backend/tests/test_events.py -q`. Expected: FAIL.

- [ ] **Step 3: Implement** `events.py`, the hook, and the calls at each site.

- [ ] **Step 4: Run** `make test` and `make lint`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -am "Record security events for auth, verification, scans, and rate limits"` (plus `git add backend/attacksurface/events.py backend/tests/test_events.py`).

---

### Task 5: `require_admin`, `/admin/me`, suspend / unsuspend

**Files:**
- Create: `backend/attacksurface/admin_store.py`, `backend/attacksurface/routers/admin.py`
- Modify: `backend/attacksurface/main.py` (`include_router(admin.router)`), `backend/attacksurface/schemas.py`
- Test: `backend/tests/test_admin.py`

**Interfaces:**
- Consumes `CurrentUser.aal` and `status` (Task 3), `settings.admin_require_mfa` (Task 2), `FakeSupabase.rpc` (Task 3), the error contract (Task 1), `netinfo.client_ip` (Task 2).
- Produces `admin_store.get_admin_role(db, user_id: str) -> str | None`.
- Produces `require_admin(min_role: Literal["viewer", "operator"]) -> Callable[..., AdminUser]`, a dependency factory. `AdminUser(id: str, email: str | None, role: str, aal: str)`. Order of checks:
  1. `get_current_user` (status already enforced);
  2. role lookup (exception → 403 `"Admin access unavailable."`; none → 403 `"Forbidden"`);
  3. role rank (`viewer` = 1, `operator` = 2) below `min_role` → 403 `"Forbidden"`;
  4. `settings.admin_require_mfa and aal != "aal2"` → 403 `"Admin access requires two-factor sign-in."`;
  5. rate limit: `admin-read:{id}` 60/min for `viewer` dependencies, `admin-write:{id}` 20/min for `operator`.
- Endpoints (`router = APIRouter(prefix="/admin", tags=["admin"])`):
  - `GET /admin/me` (`viewer`) → `{"id", "email", "role", "aal", "mfa_required": settings.admin_require_mfa}`.
  - `POST /admin/users/{user_id}/suspend` and `/unsuspend` (`operator`), body `ReasonModel(reason: str = Field(min_length=5, max_length=500))`. `user_id == admin.id` → 403 `"You can't change your own account."` before any RPC. Otherwise call `db.rpc("admin_set_user_status", {"p_actor", "p_target", "p_status": "suspended" | "active", "p_reason", "p_ip"})` and return `{"user_id", "status", "previous_status"}`.
  - `APIError.message` → HTTP: `reason_too_short` 422, `invalid_status` 422, `self_action` 403, `not_operator` 403, `not_found` 404, anything else 500 `"Admin action failed."` (logged).

- [ ] **Step 1: Write failing tests** in `test_admin.py`, seeding `admin_users` in the fake and registering an `admin_set_user_status` handler that returns the jsonb shape:
  - `test_non_admin_forbidden`: USER_B (no role) → `GET /admin/me` 403 and `POST /admin/users/{A}/suspend` 403.
  - `test_viewer_cannot_mutate`: USER_A as `viewer` → `/admin/me` 200 with `role == "viewer"`; suspend → 403 and `db.rpc_calls == []`.
  - `test_mfa_required_in_production`: monkeypatch `settings.admin_require_mfa = True`; an operator with an `aal1` token → 403 `"Admin access requires two-factor sign-in."`; with `make_token(aal="aal2")` → 200.
  - `test_role_revoked_takes_effect` (Review Focus 3): an operator gets 200, the `admin_users` row is deleted, the same token gets 403.
  - `test_self_suspend_blocked` (Review Focus 4): an operator suspends own id → 403 `"You can't change your own account."` and `db.rpc_calls == []`.
  - `test_suspend_calls_rpc`: operator A suspends B with reason `"abuse test"` → 200 `{"user_id": B, "status": "suspended", "previous_status": "active"}`; `db.rpc_calls == [("admin_set_user_status", {"p_actor": A, "p_target": B, "p_status": "suspended", "p_reason": "abuse test", "p_ip": "testclient"})]`.
  - `test_rpc_errors_mapped`: the handler raises each contract code → 422/422/403/403/404 respectively.
  - `test_short_reason_rejected`: reason `"no"` → 422 without an RPC call.

- [ ] **Step 2: Run** `uv run --project backend --locked pytest backend/tests/test_admin.py -q`. Expected: FAIL (404 on `/admin/me`).

- [ ] **Step 3: Implement** `admin_store.py`, `routers/admin.py`, the schemas, and the router registration.

- [ ] **Step 4: Run** `make test` and `make lint`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -m "Add admin role and MFA enforcement, /admin/me, audited suspend and unsuspend"` (with the new files added).

---

### Task 6: Auth outbox reconciliation in the worker

**Files:**
- Modify: `backend/attacksurface/worker.py`
- Test: `backend/tests/test_pipeline.py` (or a new `backend/tests/test_outbox.py`)

**Interfaces:**
- Produces `worker.process_outbox(db: Any, apply: Callable[[str, str], None] | None = None) -> bool`. It takes the oldest `auth_outbox` row with `status = 'pending'` and calls `apply(user_id, action)`. The default `apply` is `db.auth.admin.update_user_by_id(user_id, {"ban_duration": "876000h" if action == "ban" else "none"})`.
  - On success → `status = 'done'`, `done_at = now`.
  - On exception → `attempts += 1`, `last_error = str(exc)[:500]`, and `status = 'failed'` once `attempts >= 10`.
  - Returns True if a row was processed.
- `run_once(db)` calls `process_outbox(db)` first, so bans apply before scans run.
- `ponytail:` single worker, no row claiming; add `for update skip locked` via an RPC before running more than one worker.

- [ ] **Step 1: Write failing tests:**
  - `test_outbox_applies_ban`: a pending `ban` row plus an `apply` recorder → recorder called with `(user_id, "ban")`, the row ends `done` with `done_at` set.
  - `test_outbox_retries_then_fails`: `apply` raises `RuntimeError("auth down")` → after one call `attempts == 1`, `status == "pending"`, `last_error == "auth down"`; with `attempts` seeded at 9, one more call → `status == "failed"`.
  - `test_outbox_empty`: no rows → returns False.

- [ ] **Step 2: Run** the new tests. Expected: FAIL.

- [ ] **Step 3: Implement** `process_outbox` and the `run_once` call.

- [ ] **Step 4: Run** `make test` and `make lint`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -am "Reconcile account bans to Supabase Auth from the worker outbox"`

---

### Task 7: MFA endpoints (backend)

**Files:**
- Create: `backend/attacksurface/mfa.py` (GoTrue client)
- Modify: `backend/attacksurface/routers/auth.py`, `backend/attacksurface/schemas.py`
- Test: `backend/tests/test_auth.py`

**Interfaces:**
- Produces `class GoTrueMfa` with `list_factors(token) -> list[dict]` (from `GET {supabase_url}/auth/v1/user` → `factors`), `enroll(token) -> dict` (`POST /auth/v1/factors` `{"factor_type": "totp", "friendly_name": "AttackSurface"}`), `challenge(token, factor_id) -> str` (`POST /auth/v1/factors/{id}/challenge` → `id`), and `verify(token, factor_id, challenge_id, code) -> dict` (`POST /auth/v1/factors/{id}/verify` → session JSON).
  - Every request sends headers `apikey: SUPABASE_ANON_KEY`, `Authorization: Bearer <token>`, and a 10 s timeout.
  - GoTrue HTTP 4xx raises `MfaRejected`; transport errors and 5xx raise `MfaUnavailable`.
- Produces the dependencies `get_mfa() -> GoTrueMfa` (tests override) and `get_bearer_token(credentials) -> str`.
- Endpoints, each depending on `get_current_user`:
  - `GET /auth/mfa/factors` → `[{"id", "status", "factor_type"}]`.
  - `POST /auth/mfa/enroll` → `{"factor_id", "qr_code", "secret", "uri"}`. If a `verified` TOTP factor already exists → 409 `"Two-factor is already set up."`.
  - `POST /auth/mfa/verify` with body `{factor_id: str, code: str = Field(pattern=r"^\d{6}$")}` → challenge then verify → an `AuthSession` (via the existing `_session_out` shape; `expires_at = now + expires_in` when GoTrue omits it). `MfaRejected` → 400 `"Invalid code"`; `MfaUnavailable` → 502 `"Two-factor service unavailable"`.
- Rate limit: `mfa-verify:{user_id}` 10/min.

- [ ] **Step 1: Write failing tests** with a fake `GoTrueMfa` injected via `app.dependency_overrides[get_mfa]`:
  - `test_mfa_enroll_returns_qr`: → 200 with `qr_code`, `secret`, `factor_id`.
  - `test_mfa_enroll_twice_conflicts`: the fake lists a verified factor → 409.
  - `test_mfa_verify_returns_aal2_session`: the fake returns `{"access_token": "new", "refresh_token": "r2", "expires_in": 3600, "user": {"id": A, "email": "a@x.io"}}` → 200 with `access_token == "new"` and `expires_at` an int in the future.
  - `test_mfa_wrong_code` (Review Focus 5): the fake raises `MfaRejected` → 400 `"Invalid code"`.
  - `test_mfa_service_down` (Review Focus 5): the fake raises `MfaUnavailable` → 502.
  - `test_mfa_code_format`: code `"12ab56"` → 422 without calling the fake.

- [ ] **Step 2: Run** the tests. Expected: FAIL.

- [ ] **Step 3: Implement** `mfa.py` (httpx) and the three routes.

- [ ] **Step 4: Run** `make test` and `make lint`. Expected: all pass.

- [ ] **Step 5: Commit** `git commit -m "Add TOTP two-factor enrolment and verification endpoints"` (with the new files).

---

### Task 8: Security page (frontend)

**Files:**
- Create: `src/pages/SecurityPage.tsx`
- Modify: `src/lib/api.ts`, `src/lib/types.ts`, `src/router.tsx` (route `/account/security` inside `RequireAuth`), `src/components/AccountMenu.tsx` (a "Security" link)

**Interfaces:**
- Consumes the Task 7 routes and the `AuthUser.status` / `aal` fields from Task 3.
- Produces in `api`: `mfaFactors(): Promise<MfaFactor[]>`, `mfaEnroll(): Promise<MfaEnrollment>`, and `mfaVerify(factorId: string, code: string): Promise<AuthSession>`. `mfaVerify` calls `session.set(result)` **only on success**.
- Types: `MfaFactor { id: string; status: "verified" | "unverified"; factor_type: string }`, `MfaEnrollment { factor_id: string; qr_code: string; secret: string; uri: string }`, and `AuthUser` gains `status: string; aal: "aal1" | "aal2"`.
- With `VITE_USE_MOCKS=true`: `mfaFactors` resolves `[]`; `mfaEnroll` and `mfaVerify` reject with `ApiError("Two-factor isn't available in demo mode", 400)`.

**Page behaviour:**
- **No verified factor:** a "Set up two-factor" button → shows the QR code (`qr_code` is an SVG data URI; render with `<img alt="Two-factor QR code">`), the secret as copyable monospace text, and a 6-digit code input (`inputMode="numeric"`, `autoComplete="one-time-code"`).
- **A verified factor but `aal1`:** a code input only ("Confirm it's you").
- **A verified factor and `aal2`:** "Two-factor is on for this session."
- Errors render inline; on error the stored session is unchanged (Review Focus 5).
- Uses `PageHeader` and the existing form classes from `globals.css` (`.btn`, input styles); no new colours.

- [ ] **Step 1: Implement** the types, the api methods, the page, the route, and the menu link.

- [ ] **Step 2: Run** `npm run typecheck && npm run lint && npm run build`. Expected: all pass.

- [ ] **Step 3: Browser check** (real mode, `make dev`):
  1. Sign in → Account menu → Security.
  2. Enrol with an authenticator app → enter the code → the "Two-factor is on" state appears.
  3. `GET /auth/me` shows `aal: "aal2"`.
  4. A wrong code shows "Invalid code" and `GET /auth/me` still works with the old session.

- [ ] **Step 4: Commit** `git commit -m "Add account security page for two-factor setup"` (with the new page).

---

## Self-review notes

- **Spec coverage (ADMIN-PANEL.md §11 Phase 1):**
  - migration → Task 1
  - `require_admin` with role, status, and MFA → Tasks 3 and 5
  - MFA endpoints and enrolment screen → Tasks 7 and 8
  - `/admin/me`, `admin_store`, events (including 429s) → Tasks 4 and 5
  - decision RPC and outbox → Tasks 1, 5, and 6
  - bootstrap docs → Task 1
- **Exit criteria:**
  - non-admin 403 and viewer can't mutate → Task 5
  - no `aal2` in production → Task 5
  - rollback and append-only → Task 1 self-test
  - idempotent migration → Task 1 Step 4
- **Pulled forward from Phase 2:** the suspension check in `get_current_user`, because `require_admin` depends on it.
- **Left for later phases:** risk rules, `can_scan`, review endpoints, `REVIEW_ALL_DOMAINS`, `ai_admin_runs` writes (the table exists from Task 1).
