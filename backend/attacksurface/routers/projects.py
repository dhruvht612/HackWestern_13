from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request

from attacksurface import events
from attacksurface.config import settings
from attacksurface.database import get_db
from attacksurface.discovery import dns as dns_lookup
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.netinfo import client_ip
from attacksurface.ratelimit import limiter
from attacksurface.schemas import (
    ClientApiDocs,
    Project,
    ProjectCreate,
    Scan,
    ScanCreated,
    VerificationChallenge,
)
from attacksurface.store import (
    CHALLENGE_TTL,
    add_event,
    get_owned_project,
    now_utc,
    parse_ts,
    project_out,
    verification_status,
)
from attacksurface.validation import is_valid_root_domain

router = APIRouter(prefix="/projects", tags=["projects"])
TXT_PREFIX = "attacksurface-verification="


def _record_name(root: str) -> str:
    return f"_attacksurface-challenge.{root}"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


@router.post("", response_model=Project, status_code=201)
def create_project(payload: ProjectCreate, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    if not payload.authorization_confirmed:
        raise HTTPException(status_code=400, detail="authorization_confirmed must be true before creating a project")
    root = payload.root_domain.strip().lower()
    if not is_valid_root_domain(root):
        raise HTTPException(status_code=400, detail="root_domain must be a registrable domain (no IPs, wildcards, schemes, or paths)")
    row = db.table("projects").insert({
        "name": payload.name.strip(), "root_domain": root, "authorization_confirmed": True, "owner_user_id": user.id,
    }).execute().data[0]
    return project_out(db, row)


@router.get("", response_model=list[Project])
def list_projects(user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> list[dict]:  # noqa: B008
    rows = db.table("projects").select("*").eq("owner_user_id", user.id).order("created_at", desc=True).execute().data
    return [project_out(db, r) for r in rows]


@router.get("/{project_id}", response_model=Project)
def get_project(project_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    return project_out(db, get_owned_project(db, project_id, user))


@router.post("/{project_id}/verification", response_model=VerificationChallenge)
def issue_verification(project_id: str, request: Request, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> VerificationChallenge:  # noqa: B008
    """Issue a DNS TXT challenge. Only the hash is stored; the value is shown once."""
    limiter.check(f"verify-issue:{user.id}", 10)
    project = get_owned_project(db, project_id, user)
    token = secrets.token_urlsafe(32)
    expires = now_utc() + CHALLENGE_TTL
    db.table("projects").update({
        "verification_token_hash": _hash(token), "verification_expires_at": expires.isoformat(), "updated_at": now_utc().isoformat(),
    }).eq("id", project["id"]).execute()
    events.record(db, "verify_issued", user_id=user.id, ip=client_ip(request), subject=project["root_domain"],
                  detail={"project_id": project["id"]})
    status = verification_status(project)
    return VerificationChallenge(
        status="verified" if status == "verified" else "pending",
        record_name=_record_name(project["root_domain"]), record_value=f"{TXT_PREFIX}{token}", expires_at=expires,
        verified_at=project.get("verified_at"),
        message=f"Add a TXT record named {_record_name(project['root_domain'])} with this value, then check it. Values are shown once.",
    )


@router.post("/{project_id}/verification/check", response_model=VerificationChallenge)
async def check_verification(project_id: str, request: Request, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> VerificationChallenge:  # noqa: B008
    limiter.check(f"verify-check:{user.id}", 6)
    project = get_owned_project(db, project_id, user)
    name = _record_name(project["root_domain"])
    status = verification_status(project)
    expected = project.get("verification_token_hash")
    if not expected:
        if status == "verified":
            return VerificationChallenge(status=status, record_name=name, verified_at=project.get("verified_at"), message="Already verified.")
        raise HTTPException(status_code=409, detail="Issue a verification challenge first")
    expires = parse_ts(project.get("verification_expires_at"))
    if expires is None or expires <= now_utc():
        raise HTTPException(status_code=409, detail="The challenge expired; issue a new one")
    records = await dns_lookup.lookup_txt(name)
    if any(r.startswith(TXT_PREFIX) and hmac.compare_digest(_hash(r[len(TXT_PREFIX):]), expected) for r in records):
        now = now_utc()
        db.table("projects").update({
            "verified_at": now.isoformat(), "verification_method": "dns-txt", "verification_token_hash": None,
            "verification_expires_at": None, "updated_at": now.isoformat(),
        }).eq("id", project["id"]).execute()
        events.record(db, "verify_passed", user_id=user.id, ip=client_ip(request), subject=project["root_domain"],
                      detail={"project_id": project["id"]})
        return VerificationChallenge(status="verified", record_name=name, verified_at=now, message="Domain control verified. You can start a scan.")
    events.record(db, "verify_failed", user_id=user.id, ip=client_ip(request), subject=project["root_domain"],
                  detail={"project_id": project["id"], "records_seen": len(records)})
    return VerificationChallenge(status=status, record_name=name, expires_at=project.get("verification_expires_at"), verified_at=project.get("verified_at"),
                                 message="The TXT record wasn't found yet. DNS changes can take a few minutes; check again shortly.")


@router.get("/{project_id}/api_docs", response_model=ClientApiDocs)
def get_api_docs(project_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> ClientApiDocs:  # noqa: B008
    project = get_owned_project(db, project_id, user)
    return ClientApiDocs(file_contents=project.get("api_docs"))


@router.post("/{project_id}/api_docs", response_model=ClientApiDocs)
def post_api_docs(project_id: str, payload: ClientApiDocs, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> ClientApiDocs:  # noqa: B008
    project = get_owned_project(db, project_id, user)
    db.table("projects").update({"api_docs": payload.file_contents, "updated_at": now_utc().isoformat()}).eq("id", project["id"]).execute()
    return payload


@router.get("/{project_id}/scans", response_model=list[Scan])
def list_scans(project_id: str, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> list[dict]:  # noqa: B008
    project = get_owned_project(db, project_id, user)
    return db.table("scans").select("*").eq("project_id", project["id"]).order("created_at", desc=True).limit(50).execute().data


@router.post("/{project_id}/scans", response_model=ScanCreated, status_code=201)
def create_scan(project_id: str, request: Request, background: BackgroundTasks, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> ScanCreated:  # noqa: B008
    project = get_owned_project(db, project_id, user)
    if verification_status(project) != "verified":
        raise HTTPException(status_code=403, detail="Verify domain control before scanning this project")
    active = db.table("scans").select("id").eq("project_id", project["id"]).in_("status", ["queued", "running"]).execute().data
    if active:
        raise HTTPException(status_code=409, detail=f"A scan is already in progress ({active[0]['id']})")
    limiter.check(f"scan:{user.id}", settings.scan_rate_limit_per_min)
    scan = db.table("scans").insert({"project_id": project["id"], "status": "queued", "created_by": user.id}).execute().data[0]
    add_event(db, scan["id"], "Scan queued.")
    events.record(db, "scan_started", user_id=user.id, ip=client_ip(request), subject=project["root_domain"],
                  detail={"project_id": project["id"], "scan_id": scan["id"]})
    if settings.run_jobs_inline:
        from attacksurface.worker import process_scan

        background.add_task(process_scan, scan["id"])
    return ScanCreated(scan_id=scan["id"], status="queued", project_id=project["id"])
