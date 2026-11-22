"""Admin-only data access. Unlike store.py, nothing here is scoped to the caller's own rows,
so every function must only be reached through routers/admin.py's require_admin checks."""

from __future__ import annotations

from typing import Any

ROLE_RANK = {"viewer": 1, "operator": 2}


def get_admin_role(db: Any, user_id: str) -> str | None:
    rows = db.table("admin_users").select("role").eq("user_id", user_id).limit(1).execute().data
    return rows[0]["role"] if rows else None
