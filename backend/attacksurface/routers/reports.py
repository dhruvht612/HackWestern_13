from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse

from attacksurface.database import get_db
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.reports import save_report
from attacksurface.store import first, get_owned_scan

router = APIRouter(tags=["reports"])


@router.get("/scans/{scan_id}/report.md", response_class=PlainTextResponse)
def get_report(scan_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> PlainTextResponse:  # noqa: B008
    scan, _ = get_owned_scan(db, scan_id, user)
    if scan["status"] in ("queued", "running"):
        raise HTTPException(status_code=409, detail="The report is generated when the scan finishes")
    row = first(db.table("reports").select("markdown").eq("scan_id", scan_id).execute())
    markdown = row["markdown"] if row else save_report(db, scan_id)
    return PlainTextResponse(markdown, media_type="text/markdown; charset=utf-8")
