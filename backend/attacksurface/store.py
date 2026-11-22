"""Ownership-scoped data access shared by routers and the worker.

The backend talks to Postgres with the service role (RLS bypassed), so *every* read of
user data goes through one of these helpers, which scope it to the caller.
"""

from __future__ import annotations

import re
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException

from attacksurface.jwt import CurrentUser

UUID_RE = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
VERIFICATION_TTL = timedelta(days=90)
CHALLENGE_TTL = timedelta(days=7)
NOT_FOUND = "Not found"


def now_utc() -> datetime:
    return datetime.now(UTC)


def parse_ts(value: Any) -> datetime | None:
    if value is None or isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))


def first(resp: Any) -> dict[str, Any] | None:
    return resp.data[0] if resp.data else None


def get_owned_project(db: Any, project_id: str, user: CurrentUser) -> dict[str, Any]:
    # Same 404 for "doesn't exist" and "belongs to someone else": no existence oracle.
    if not UUID_RE.match(project_id or ""):
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    row = first(db.table("projects").select("*").eq("id", project_id).eq("owner_user_id", user.id).execute())
    if row is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    return row


def get_owned_scan(db: Any, scan_id: str, user: CurrentUser) -> tuple[dict[str, Any], dict[str, Any]]:
    if not UUID_RE.match(scan_id or ""):
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    scan = first(db.table("scans").select("*").eq("id", scan_id).execute())
    if scan is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    project = get_owned_project(db, scan["project_id"], user)
    return scan, project


def verification_status(project: dict[str, Any], now: datetime | None = None) -> str:
    now = now or now_utc()
    verified_at = parse_ts(project.get("verified_at"))
    if verified_at:
        return "verified" if now - verified_at < VERIFICATION_TTL else "expired"
    expires = parse_ts(project.get("verification_expires_at"))
    if project.get("verification_token_hash") and expires and expires > now:
        return "pending"
    return "unverified"


def latest_scan_id(db: Any, project_id: str) -> str | None:
    row = first(
        db.table("scans").select("id").eq("project_id", project_id).order("created_at", desc=True).limit(1).execute()
    )
    return row["id"] if row else None


def project_out(db: Any, project: dict[str, Any]) -> dict[str, Any]:
    return {
        **project,
        "verification_status": verification_status(project),
        "latest_scan_id": latest_scan_id(db, project["id"]),
    }


def add_event(db: Any, scan_id: str, message: str, level: str = "info") -> None:
    db.table("scan_events").insert(
        {"scan_id": scan_id, "level": level, "message": message[:1000], "timestamp": now_utc().isoformat()}
    ).execute()


def scan_with_events(db: Any, scan: dict[str, Any]) -> dict[str, Any]:
    events = db.table("scan_events").select("*").eq("scan_id", scan["id"]).order("timestamp").execute().data
    return {**scan, "events": events}
