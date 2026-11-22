"""Admin portal API. Every route goes through require_admin; mutations need the operator role,
a reason, and run as one Postgres function so the change and its audit row commit together."""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import datetime
from hmac import compare_digest
from typing import Annotated, Any, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from postgrest.exceptions import APIError
from pydantic import BaseModel

from attacksurface.admin_store import ROLE_RANK, get_admin_role
from attacksurface.ai.copilot import CopilotQuestion, ask
from attacksurface.ai.reviewer import PROMPT_VERSION
from attacksurface.config import settings
from attacksurface.database import get_db
from attacksurface.discovery.dns import lookup_txt
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.netinfo import client_ip
from attacksurface.netsafety import normalize_hostname
from attacksurface.ratelimit import limiter
from attacksurface.routers.projects import TXT_PREFIX, _hash, _record_name
from attacksurface.schemas import (
    AdminAuditEntry,
    AdminBlock,
    AdminDailyBrief,
    AdminDomain,
    AdminMe,
    AdminOverview,
    AdminPage,
    AdminReview,
    AdminReviewDetail,
    AdminSecurityEvent,
    AdminUserDetail,
    AdminUserRow,
    BlockPattern,
    DnsRecheck,
    DomainAuthorization,
    ReasonModel,
    ReviewDecision,
    UserStatusChange,
)
from attacksurface.store import VERIFICATION_TTL, first, now_utc, parse_ts

log = logging.getLogger("attacksurface.admin")
router = APIRouter(prefix="/admin", tags=["admin"])

# Postgres function error (RAISE EXCEPTION message) -> HTTP status.
RPC_ERRORS = {
    "reason_too_short": 422, "invalid_status": 422, "invalid_reason": 422, "invalid_decision": 422,
    "self_action": 403, "not_operator": 403, "not_found": 404,
    "already_decided": 409, "review_target_changed": 409, "duplicate_pattern": 409,
}
RPC_DETAIL = {
    "reason_too_short": "Give a reason of at least 5 characters.",
    "invalid_status": "Unknown status.",
    "self_action": "You can't change your own account.",
    "not_operator": "Forbidden",
    "not_found": "Record not found.",
    "invalid_reason": "Give a reason of 5 to 500 characters.",
    "invalid_decision": "Unknown decision.",
    "already_decided": "Someone else already decided this.",
    "review_target_changed": "The target no longer has the required status.",
    "duplicate_pattern": "That pattern is already blocked.",
}


class AdminUser(BaseModel):
    id: str
    email: str | None = None
    role: str
    aal: str


def require_admin(min_role: Literal["viewer", "operator"]) -> Callable[..., AdminUser]:
    def dependency(user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> AdminUser:  # noqa: B008
        if user.status != "active":
            raise HTTPException(status_code=403, detail="Forbidden")
        try:
            role = get_admin_role(db, user.id)
        except Exception:
            raise HTTPException(status_code=403, detail="Admin access unavailable.") from None
        if role is None or ROLE_RANK.get(role, 0) < ROLE_RANK[min_role]:
            raise HTTPException(status_code=403, detail="Forbidden")
        if settings.admin_require_mfa and user.aal != "aal2":
            raise HTTPException(status_code=403, detail="Admin access requires two-factor sign-in.")
        if min_role == "operator":
            limiter.check(f"admin-write:{user.id}", 20)
        else:
            limiter.check(f"admin-read:{user.id}", 60)
        return AdminUser(id=user.id, email=user.email, role=role, aal=user.aal)

    return dependency


def call_admin_function(db: Any, name: str, params: dict[str, Any]) -> Any:
    try:
        return db.rpc(name, params).execute().data
    except APIError as exc:
        code = exc.message or ""
        if code in RPC_ERRORS:
            raise HTTPException(status_code=RPC_ERRORS[code], detail=RPC_DETAIL[code]) from None
        log.error("admin function %s failed: %s", name, exc)
        raise HTTPException(status_code=500, detail="Admin action failed.") from None


@router.get("/me", response_model=AdminMe)
def admin_me(admin: AdminUser = Depends(require_admin("viewer"))) -> AdminMe:  # noqa: B008
    return AdminMe(id=admin.id, email=admin.email, role=admin.role, aal=admin.aal, mfa_required=settings.admin_require_mfa)


ReadAdmin = Annotated[AdminUser, Depends(require_admin("viewer"))]
WriteAdmin = Annotated[AdminUser, Depends(require_admin("operator"))]
AdminDB = Annotated[Any, Depends(get_db)]
PageLimit = Annotated[int, Query(ge=1, le=100)]
EventCursor = Annotated[int | None, Query(ge=1, le=2**63 - 1)]


def _get_row(db: Any, table: str, key: str, identifier: str) -> dict[str, Any]:
    row = first(db.table(table).select("*").eq(key, identifier).limit(1).execute())
    if row is None:
        raise HTTPException(status_code=404, detail="Record not found.")
    return row


def _audit_args(admin: AdminUser, reason: str, request: Request) -> dict[str, Any]:
    return {"p_actor": admin.id, "p_reason": reason, "p_ip": client_ip(request)}


def _recent_user_events(db: Any, user_id: str, email: str | None) -> list[dict[str, Any]]:
    rows = db.table("security_events").select("id,type,user_id,ip,subject,detail,created_at").eq("user_id", user_id).order("id", desc=True).limit(50).execute().data
    return [{**row, "user_email": email} for row in rows]


def _page(rows: list[dict[str, Any]], limit: int, cursor_for: Callable[[dict[str, Any]], str]) -> dict[str, Any]:
    return {"items": rows[:limit], "next_cursor": cursor_for(rows[limit - 1]) if len(rows) > limit else None}


@router.get("/users", response_model=AdminPage[AdminUserRow])
def list_users(
    _admin: ReadAdmin,
    db: AdminDB,
    q: Annotated[str | None, Query(max_length=254)] = None,
    status: Literal["active", "pending_review", "suspended"] | None = None,
    risk: Literal["low", "medium", "high"] | None = None,
    limit: PageLimit = 50,
    cursor: Annotated[str | None, Query(max_length=100)] = None,
) -> dict[str, Any]:
    after_at = after_id = None
    if cursor is not None:
        try:
            timestamp, user_id = cursor.split("|", maxsplit=1)
            parsed = datetime.fromisoformat(timestamp)
            if parsed.tzinfo is None:
                raise ValueError("Missing timestamp offset")
            after_at, after_id = parsed.isoformat(), str(UUID(user_id))
        except ValueError:
            raise HTTPException(status_code=422, detail="Invalid users cursor.") from None
    rows = call_admin_function(db, "admin_list_users", {
        "p_q": (q or "").strip() or None, "p_status": status, "p_risk": risk,
        "p_limit": limit + 1, "p_after_at": after_at, "p_after_id": after_id,
    })
    return _page(rows, limit, lambda row: f"{row['created_at']}|{row['id']}")


@router.get("/users/{user_id}", response_model=AdminUserDetail)
def user_detail(user_id: UUID, _admin: ReadAdmin, db: AdminDB) -> dict[str, Any]:
    profile = call_admin_function(db, "admin_user_profile", {"p_user": str(user_id)})
    if not profile:
        raise HTTPException(status_code=404, detail="Account not found.")
    claims = db.table("admin_domain_rows").select("*").eq("owner_id", str(user_id)).order("project_id").limit(50).execute().data
    return {**profile, "claims": claims, "recent_events": _recent_user_events(db, str(user_id), profile["email"])}


@router.get("/reviews", response_model=AdminPage[AdminReview])
def list_reviews(
    _admin: ReadAdmin, db: AdminDB, status: Literal["pending", "approved", "rejected", "decided"] | None = None,
    kind: Literal["user", "domain"] | None = None, limit: PageLimit = 50, cursor: UUID | None = None,
) -> dict[str, Any]:
    rows = call_admin_function(db, "admin_list_reviews", {
        "p_status": status, "p_kind": kind, "p_limit": limit + 1, "p_after": str(cursor) if cursor else None,
    })
    return _page(rows, limit, lambda row: row["id"])


@router.get("/reviews/{review_id}", response_model=AdminReviewDetail)
def review_detail(review_id: UUID, _admin: ReadAdmin, db: AdminDB) -> dict[str, Any]:
    row = _get_row(db, "admin_review_rows", "id", str(review_id))
    return {**row, "recent_events": _recent_user_events(db, row["user_id"], row["user_email"])}


@router.post("/reviews/{review_id}/decision", response_model=AdminReview)
def decide_review(review_id: UUID, body: ReviewDecision, request: Request, admin: WriteAdmin, db: AdminDB) -> dict[str, Any]:
    call_admin_function(db, "admin_decide_review", {
        "p_id": str(review_id), "p_decision": body.decision, **_audit_args(admin, body.reason, request),
    })
    return _get_row(db, "admin_review_rows", "id", str(review_id))


@router.post("/reviews/{review_id}/reanalyze", status_code=202, response_model=AdminReview)
def reanalyze_review(review_id: UUID, body: ReasonModel, request: Request, admin: WriteAdmin, db: AdminDB) -> dict[str, Any]:
    limiter.check(f"admin-ai:{admin.id}", 10)
    call_admin_function(db, "admin_requeue_review", {
        "p_id": str(review_id), **_audit_args(admin, body.reason, request),
    })
    return _get_row(db, "admin_review_rows", "id", str(review_id))


@router.get("/domains", response_model=AdminPage[AdminDomain])
def list_domains(
    _admin: ReadAdmin, db: AdminDB, status: DomainAuthorization | None = None,
    limit: PageLimit = 50, cursor: UUID | None = None,
) -> dict[str, Any]:
    q = db.table("admin_domain_rows").select("*").order("project_id").limit(limit + 1)
    if status:
        q = q.eq("authorization", status)
    if cursor:
        q = q.gt("project_id", str(cursor))
    return _page(q.execute().data, limit, lambda row: row["project_id"])


@router.post("/domains/{project_id}/revoke", response_model=AdminDomain)
def revoke_domain(project_id: UUID, body: ReasonModel, request: Request, admin: WriteAdmin, db: AdminDB) -> dict[str, Any]:
    call_admin_function(db, "admin_revoke_domain", {
        "p_project": str(project_id), **_audit_args(admin, body.reason, request),
    })
    return _get_row(db, "admin_domain_rows", "project_id", str(project_id))


@router.post("/domains/{project_id}/recheck", response_model=DnsRecheck)
async def recheck_domain(project_id: UUID, body: ReasonModel, request: Request, admin: WriteAdmin, db: AdminDB) -> DnsRecheck:
    project = _get_row(db, "projects", "id", str(project_id))
    root = normalize_hostname(project["root_domain"])
    expires_at = parse_ts(project.get("verification_expires_at"))
    active_token = project.get("verification_token_hash") if expires_at and expires_at > now_utc() else None
    expected = active_token or project.get("verified_token_hash")
    if not root or not expected:
        raise HTTPException(status_code=409, detail="No current verification record is on file. Ask the owner to issue a new challenge.")
    records = await lookup_txt(_record_name(root))
    found = any(r.startswith(TXT_PREFIX) and compare_digest(_hash(r[len(TXT_PREFIX):]), expected) for r in records)
    db.table("admin_audit_log").insert({
        "actor_id": admin.id, "action": "domain.recheck", "target_type": "project", "target_id": str(project_id),
        "reason": body.reason, "ip": client_ip(request), "detail": {"found": found},
    }).execute()
    return DnsRecheck(found=found, checked_at=now_utc())


@router.get("/blocklist", response_model=AdminPage[AdminBlock])
def list_blocklist(_admin: ReadAdmin, db: AdminDB, limit: PageLimit = 50, cursor: Annotated[str | None, Query(max_length=253)] = None) -> dict[str, Any]:
    q = db.table("domain_blocklist").select("pattern,match,reason,created_at").order("pattern").limit(limit + 1)
    if cursor:
        q = q.gt("pattern", cursor)
    return _page(q.execute().data, limit, lambda row: row["pattern"])


def _pattern(value: str) -> str:
    pattern = normalize_hostname(value)
    if pattern is None:
        raise HTTPException(status_code=422, detail="Enter a domain without a scheme, path, or wildcard.")
    return pattern


@router.post("/blocklist", status_code=201, response_model=AdminBlock)
def add_block(body: BlockPattern, request: Request, admin: WriteAdmin, db: AdminDB) -> Any:
    return call_admin_function(db, "admin_blocklist_change", {
        "p_pattern": _pattern(body.pattern), "p_match": body.match, **_audit_args(admin, body.reason, request),
    })


@router.delete("/blocklist", status_code=204)
def remove_block(pattern: str, body: ReasonModel, request: Request, admin: WriteAdmin, db: AdminDB) -> Response:
    call_admin_function(db, "admin_blocklist_change", {
        "p_pattern": _pattern(pattern), "p_match": None, **_audit_args(admin, body.reason, request),
    })
    return Response(status_code=204)


@router.get("/events", response_model=AdminPage[AdminSecurityEvent])
def list_events(
    _admin: ReadAdmin,
    db: AdminDB,
    type: Annotated[str | None, Query(max_length=80)] = None,
    limit: PageLimit = 50,
    cursor: EventCursor = None,
) -> dict[str, Any]:
    rows = call_admin_function(db, "admin_list_events", {"p_type": type, "p_limit": limit + 1, "p_after_id": cursor})
    return _page(rows, limit, lambda row: str(row["id"]))


@router.get("/audit", response_model=AdminPage[AdminAuditEntry])
def list_audit(
    _admin: ReadAdmin,
    db: AdminDB,
    action: Annotated[str | None, Query(max_length=80)] = None,
    limit: PageLimit = 50,
    cursor: EventCursor = None,
) -> dict[str, Any]:
    rows = call_admin_function(db, "admin_list_audit", {"p_action": action, "p_limit": limit + 1, "p_after_id": cursor})
    return _page(rows, limit, lambda row: str(row["id"]))


@router.get("/overview", response_model=AdminOverview)
def overview(_admin: ReadAdmin, db: AdminDB) -> AdminOverview:
    counts, = call_admin_function(db, "admin_overview_counts", {
        "p_verified_since": (now_utc() - VERIFICATION_TTL).isoformat(),
    })
    heartbeat = first(db.table("worker_health").select("last_seen").eq("singleton", True).limit(1).execute())
    return AdminOverview(
        **counts,
        worker_last_seen=heartbeat["last_seen"] if heartbeat else None,
        daily_brief=AdminDailyBrief(
            source="template",
            text=(
                f"In the last 24 hours, {counts['scans_24h']} scans were queued, "
                f"{counts['scan_failures_24h']} scans failed, and {counts['blocklist_hits_24h']} blocklist hits were recorded. "
                f"Reviews awaiting a decision: {counts['pending_reviews']}."
            ),
        ),
    )


@router.get("/ai/metrics")
def ai_metrics(_admin: ReadAdmin, db: AdminDB) -> dict[str, Any]:
    metrics = call_admin_function(db, "admin_ai_metrics", {})
    return {**metrics, "active_model": settings.gemini_model if settings.gemini_api_key else None, "prompt_version": PROMPT_VERSION}


@router.post("/copilot")
def copilot(body: CopilotQuestion, request: Request, admin: ReadAdmin, db: AdminDB) -> dict[str, Any]:
    limiter.check(f"admin-ai:{admin.id}", 10)
    return ask(db, admin.id, client_ip(request), body.question)


def _set_status(user_id: str, status: str, body: ReasonModel, request: Request, admin: AdminUser, db: Any) -> UserStatusChange:
    if user_id == admin.id:
        raise HTTPException(status_code=403, detail="You can't change your own account.")
    data = call_admin_function(db, "admin_set_user_status", {
        "p_actor": admin.id, "p_target": user_id, "p_status": status, "p_reason": body.reason, "p_ip": client_ip(request),
    })
    row = data[0] if isinstance(data, list) else data
    return UserStatusChange(**row)


@router.post("/users/{user_id}/suspend", response_model=UserStatusChange)
def suspend_user(user_id: UUID, body: ReasonModel, request: Request, admin: AdminUser = Depends(require_admin("operator")), db: Any = Depends(get_db)) -> UserStatusChange:  # noqa: B008
    return _set_status(str(user_id), "suspended", body, request, admin, db)


@router.post("/users/{user_id}/unsuspend", response_model=UserStatusChange)
def unsuspend_user(user_id: UUID, body: ReasonModel, request: Request, admin: AdminUser = Depends(require_admin("operator")), db: Any = Depends(get_db)) -> UserStatusChange:  # noqa: B008
    return _set_status(str(user_id), "active", body, request, admin, db)
