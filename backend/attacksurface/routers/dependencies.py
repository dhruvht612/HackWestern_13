from __future__ import annotations

from typing import Any

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from attacksurface.config import settings
from attacksurface.database import get_db
from attacksurface.intel import osv
from attacksurface.intel.deps import ManifestError, parse_manifest
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.netsafety import in_scope, normalize_hostname
from attacksurface.ratelimit import limiter
from attacksurface.schemas import Dependency
from attacksurface.store import get_owned_project

router = APIRouter(prefix="/projects/{project_id}/dependencies", tags=["dependencies"])


def _deployed_asset(db: Any, project: dict, hostname: str) -> dict:
    """The host must be in scope AND already discovered for this project. Returns its newest asset row."""
    if not in_scope(hostname, project["root_domain"]):
        raise HTTPException(status_code=400, detail="deployed_on must be a host inside this project's domain")
    scan_ids = [s["id"] for s in db.table("scans").select("id").eq("project_id", project["id"]).execute().data]
    rows = db.table("assets").select("*").eq("hostname", hostname).in_("scan_id", scan_ids).order("created_at", desc=True).limit(1).execute().data if scan_ids else []
    if not rows:
        raise HTTPException(status_code=400, detail="deployed_on must be a host discovered by a scan of this project")
    return rows[0]


@router.post("", response_model=list[Dependency])
async def upload_dependencies(
    project_id: str,
    file: UploadFile = File(...),  # noqa: B008
    deployed_on: str | None = Form(default=None),  # noqa: B008
    user: CurrentUser = Depends(get_current_user),  # noqa: B008
    db: Any = Depends(get_db),  # noqa: B008
) -> list[dict]:
    limiter.check(f"upload:{user.id}", 10)
    project = get_owned_project(db, project_id, user)
    content = await file.read(settings.upload_max_bytes + 1)
    if len(content) > settings.upload_max_bytes:
        raise HTTPException(status_code=413, detail=f"Manifest exceeds {settings.upload_max_bytes // 1024 // 1024} MB")
    try:
        packages = parse_manifest(file.filename or "", content)
    except ManifestError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from None

    host = None
    asset = None
    if deployed_on:
        host = normalize_hostname(deployed_on)
        if host is None:
            raise HTTPException(status_code=400, detail="deployed_on is not a valid hostname")
        asset = _deployed_asset(db, project, host)

    try:
        matches = await osv.match_packages(packages)
    except (httpx.HTTPError, ValueError):
        # Saving packages without advisories would read as "no vulnerabilities". Refuse instead.
        raise HTTPException(status_code=502, detail="OSV.dev lookup failed; nothing was saved. Try again.") from None
    by_pkg = {m.package: m for m in matches}

    rows = [{
        "project_id": project["id"], "package_name": p.name, "version": p.version, "ecosystem": "npm", "direct": p.direct,
        "resolved": p.resolved, "manifest_name": (file.filename or "").rsplit("/", 1)[-1],
        "advisories": by_pkg[p].advisories if p in by_pkg else [], "fixed_version": by_pkg[p].fixed_version if p in by_pkg else None,
        "deployed_on": host, "asset_id": asset["id"] if asset else None,
    } for p in packages]

    # A new upload for the same deployment target replaces the previous manifest for it.
    delete = db.table("dependencies").delete().eq("project_id", project["id"])
    delete = delete.eq("deployed_on", host) if host else delete.is_("deployed_on", "null")
    delete.execute()
    return db.table("dependencies").insert(rows).execute().data if rows else []


@router.get("", response_model=list[Dependency])
def list_dependencies(project_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> list[dict]:  # noqa: B008
    project = get_owned_project(db, project_id, user)
    return db.table("dependencies").select("*").eq("project_id", project["id"]).order("package_name").execute().data
