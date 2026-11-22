from __future__ import annotations

from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException

from attacksurface.config import settings
from attacksurface.database import get_db
from attacksurface.graph import build_graph
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.ratelimit import limiter
from attacksurface.schemas import Analysis, Graph
from attacksurface.store import first, get_owned_scan

router = APIRouter(tags=["analysis"])
FINISHED = ("completed", "partial")


def analysis_out(row: dict[str, Any]) -> dict[str, Any]:
    result = row.get("result") or {"executive_summary": "", "findings": [], "missing_evidence": []}
    return {**result, "id": row["id"], "scan_id": row["scan_id"], "status": row["status"], "source": row.get("source"), "model": row.get("model"),
            "prompt_version": row.get("prompt_version"), "validation_errors": row.get("validation_errors") or [], "error": row.get("error"),
            "generated_at": row.get("updated_at")}


@router.get("/scans/{scan_id}/graph", response_model=Graph)
def get_graph(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    scan, project = get_owned_scan(db, scan_id, user)
    return build_graph(db, scan, project)


@router.post("/scans/{scan_id}/analyze", response_model=Analysis, status_code=202)
def request_analysis(scan_id: str, background: BackgroundTasks, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    scan, _ = get_owned_scan(db, scan_id, user)
    if scan["status"] not in FINISHED:
        raise HTTPException(status_code=409, detail="Analysis is available once the scan has finished")
    pending = first(db.table("analyses").select("*").eq("scan_id", scan_id).in_("status", ["queued", "running"]).limit(1).execute())
    if pending:
        return analysis_out(pending)  # no duplicate jobs
    limiter.check(f"analysis:{user.id}", 5)
    row = db.table("analyses").insert({"scan_id": scan_id, "status": "queued", "requested_by": user.id}).execute().data[0]
    if settings.run_jobs_inline:
        from attacksurface.worker import process_analysis

        background.add_task(process_analysis, row["id"])
    return analysis_out(row)


@router.get("/scans/{scan_id}/analysis", response_model=Analysis)
def get_analysis(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    get_owned_scan(db, scan_id, user)
    row = first(db.table("analyses").select("*").eq("scan_id", scan_id).order("created_at", desc=True).limit(1).execute())
    if row is None:
        raise HTTPException(status_code=404, detail="No analysis has been requested for this scan")
    return analysis_out(row)
