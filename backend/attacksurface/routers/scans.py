from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from attacksurface.database import get_db
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.schemas import Asset, AssetUpdate, Evidence, Finding, Scan, ScanEvent
from attacksurface.store import (
    NOT_FOUND,
    UUID_RE,
    add_event,
    first,
    get_owned_project,
    get_owned_scan,
    now_utc,
    scan_with_events,
)

router = APIRouter(tags=["scans"])


@router.get("/scans/{scan_id}", response_model=Scan)
def get_scan(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    scan, _ = get_owned_scan(db, scan_id, user)
    return scan_with_events(db, scan)


@router.get("/scans/{scan_id}/events", response_model=list[ScanEvent])
def get_scan_events(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> list[dict]:  # noqa: B008
    scan, _ = get_owned_scan(db, scan_id, user)
    return scan_with_events(db, scan)["events"]


@router.post("/scans/{scan_id}/cancel", response_model=Scan)
def cancel_scan(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    scan, _ = get_owned_scan(db, scan_id, user)
    if scan["status"] not in ("queued", "running"):
        raise HTTPException(status_code=409, detail=f"Scan is already {scan['status']}")
    updated = db.table("scans").update({"status": "cancelled", "completed_at": now_utc().isoformat(), "updated_at": now_utc().isoformat()}).eq("id", scan_id).execute().data[0]
    add_event(db, scan_id, "Cancellation requested.", "warn")
    return scan_with_events(db, updated)


@router.get("/scans/{scan_id}/assets", response_model=list[Asset])
def get_scan_assets(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> list[dict]:  # noqa: B008
    get_owned_scan(db, scan_id, user)
    return db.table("assets").select("*").eq("scan_id", scan_id).order("hostname").execute().data


@router.get("/scans/{scan_id}/findings", response_model=list[Finding])
def get_scan_findings(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> list[dict]:  # noqa: B008
    get_owned_scan(db, scan_id, user)
    return db.table("findings").select("*").eq("scan_id", scan_id).execute().data


@router.get("/scans/{scan_id}/evidence", response_model=list[Evidence])
def get_scan_evidence(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> list[dict]:  # noqa: B008
    get_owned_scan(db, scan_id, user)
    return db.table("evidence").select("*").eq("scan_id", scan_id).execute().data


@router.patch("/assets/{asset_id}", response_model=Asset)
def update_asset(asset_id: str, payload: AssetUpdate, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    """Let the owner correct an inferred environment."""
    if not UUID_RE.match(asset_id):
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    asset = first(db.table("assets").select("*").eq("id", asset_id).execute())
    if asset is None:
        raise HTTPException(status_code=404, detail=NOT_FOUND)
    scan = first(db.table("scans").select("project_id").eq("id", asset["scan_id"]).execute())
    get_owned_project(db, scan["project_id"], user)
    return db.table("assets").update({"environment": payload.environment, "environment_source": "user", "environment_confidence": "high"}).eq("id", asset_id).execute().data[0]
