"""Admin portal API. Every route goes through require_admin; mutations need the operator role,
a reason, and run as one Postgres function so the change and its audit row commit together."""

from __future__ import annotations

import logging
from collections.abc import Callable
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from postgrest.exceptions import APIError
from pydantic import BaseModel

from attacksurface.admin_store import ROLE_RANK, get_admin_role
from attacksurface.config import settings
from attacksurface.database import get_db
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.netinfo import client_ip
from attacksurface.ratelimit import limiter
from attacksurface.schemas import AdminMe, ReasonModel, UserStatusChange

log = logging.getLogger("attacksurface.admin")
router = APIRouter(prefix="/admin", tags=["admin"])

# Postgres function error (RAISE EXCEPTION message) -> HTTP status.
RPC_ERRORS = {"reason_too_short": 422, "invalid_status": 422, "self_action": 403, "not_operator": 403, "not_found": 404}
RPC_DETAIL = {
    "reason_too_short": "Give a reason of at least 5 characters.",
    "invalid_status": "Unknown status.",
    "self_action": "You can't change your own account.",
    "not_operator": "Forbidden",
    "not_found": "User not found.",
}


class AdminUser(BaseModel):
    id: str
    email: str | None = None
    role: str
    aal: str


def require_admin(min_role: Literal["viewer", "operator"]) -> Callable[..., AdminUser]:
    def dependency(user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> AdminUser:  # noqa: B008
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


def call_admin_function(db: Any, name: str, params: dict[str, Any]) -> dict[str, Any]:
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


def _set_status(user_id: str, status: str, body: ReasonModel, request: Request, admin: AdminUser, db: Any) -> UserStatusChange:
    if user_id == admin.id:
        raise HTTPException(status_code=403, detail="You can't change your own account.")
    data = call_admin_function(db, "admin_set_user_status", {
        "p_actor": admin.id, "p_target": user_id, "p_status": status, "p_reason": body.reason, "p_ip": client_ip(request),
    })
    row = data[0] if isinstance(data, list) else data
    return UserStatusChange(**row)


@router.post("/users/{user_id}/suspend", response_model=UserStatusChange)
def suspend_user(user_id: str, body: ReasonModel, request: Request, admin: AdminUser = Depends(require_admin("operator")), db: Any = Depends(get_db)) -> UserStatusChange:  # noqa: B008
    return _set_status(user_id, "suspended", body, request, admin, db)


@router.post("/users/{user_id}/unsuspend", response_model=UserStatusChange)
def unsuspend_user(user_id: str, body: ReasonModel, request: Request, admin: AdminUser = Depends(require_admin("operator")), db: Any = Depends(get_db)) -> UserStatusChange:  # noqa: B008
    return _set_status(user_id, "active", body, request, admin, db)
