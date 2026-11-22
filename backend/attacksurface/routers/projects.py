from __future__ import annotations

import hashlib
import hmac
import secrets
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from postgrest.exceptions import APIError

from attacksurface import events
from attacksurface.config import settings
from attacksurface.database import get_db
from attacksurface.discovery import dns as dns_lookup
from attacksurface.jwt import CurrentUser, get_current_user
from attacksurface.netinfo import client_ip
from attacksurface.netsafety import normalize_hostname
from attacksurface.ratelimit import limiter
from attacksurface.risk import signal
from attacksurface.risk_signals import domain_signals
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
    authorization_status,
    can_scan,
    domain_blocked,
    get_owned_project,
    now_utc,
    parse_ts,
    project_out,
    verification_status,
)

router = APIRouter(prefix="/projects", tags=["projects"])
TXT_PREFIX = "attacksurface-verification="


def _record_name(root: str) -> str:
    return f"_attacksurface-challenge.{root}"


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _check_claim_allowed(db: Any, root: str, user: CurrentUser, request: Request) -> None:
    if domain_blocked(db, root):
        events.record(db, "blocklist_hit", user_id=user.id, ip=client_ip(request), subject=root)
        raise HTTPException(status_code=403, detail="This domain is blocked by platform policy. Contact support if you own it.")


@router.post("", response_model=Project, status_code=201)
def create_project(payload: ProjectCreate, request: Request, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> dict:  # noqa: B008
    if not payload.authorization_confirmed:
        raise HTTPException(status_code=400, detail="authorization_confirmed must be true before creating a project")
    root = normalize_hostname(payload.root_domain)
    if root is None:
        raise HTTPException(status_code=400, detail="root_domain must be a registrable domain (no IPs, wildcards, schemes, or paths)")
    _check_claim_allowed(db, root, user, request)
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
    _check_claim_allowed(db, project["root_domain"], user, request)
    if authorization_status(project) == "revoked":
        raise HTTPException(status_code=403, detail="Authorization for this domain has been revoked.")
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
        authorization=authorization_status(project),
        record_name=_record_name(project["root_domain"]), record_value=f"{TXT_PREFIX}{token}", expires_at=expires,
        verified_at=project.get("verified_at"),
        message=f"Add a TXT record named {_record_name(project['root_domain'])} with this value, then check it. Values are shown once.",
    )


@router.post("/{project_id}/verification/check", response_model=VerificationChallenge)
async def check_verification(project_id: str, request: Request, user: CurrentUser = Depends(get_current_user), db: Any = Depends(get_db)) -> VerificationChallenge:  # noqa: B008
    limiter.check(f"verify-check:{user.id}", 6)
    project = get_owned_project(db, project_id, user)
    _check_claim_allowed(db, project["root_domain"], user, request)
    name = _record_name(project["root_domain"])
    status = verification_status(project)
    authorization = authorization_status(project)
    if authorization == "revoked":
        raise HTTPException(status_code=403, detail="Authorization for this domain has been revoked.")
    expected = project.get("verification_token_hash")
    if not expected:
        if status == "verified":
            return VerificationChallenge(status=status, authorization=authorization, record_name=name, verified_at=project.get("verified_at"), message="Domain control is already verified.")
        raise HTTPException(status_code=409, detail="Issue a verification challenge first")
    expires = parse_ts(project.get("verification_expires_at"))
    if expires is None or expires <= now_utc():
        raise HTTPException(status_code=409, detail="The challenge expired; issue a new one")
    records = await dns_lookup.lookup_txt(name)
    if any(r.startswith(TXT_PREFIX) and hmac.compare_digest(_hash(r[len(TXT_PREFIX):]), expected) for r in records):
        risk, signals = domain_signals(db, project["root_domain"], user.id, user.email)
        if risk != "low":
            signals.append(signal("dns_proof", "Domain control", "DNS TXT challenge passed"))
        try:
            proof = db.rpc("record_domain_proof", {
                "p_project": project_id, "p_hash": expected, "p_level": risk, "p_signals": signals,
            }).execute().data
        except APIError as exc:
            if exc.message == "challenge_changed":
                raise HTTPException(status_code=409, detail="The DNS challenge changed. Refresh and try again.") from None
            if exc.message in {"domain_blocked", "revoked"}:
                raise HTTPException(status_code=403, detail="This domain cannot be authorized under current policy.") from None
            raise HTTPException(status_code=503, detail="Could not save verification. Try again.") from None
        events.record(db, "verify_passed", user_id=user.id, ip=client_ip(request), subject=project["root_domain"],
                      detail={"project_id": project["id"]})
        if proof["queued"]:
            events.record(db, "review_queued", user_id=user.id, subject=project["root_domain"], detail={"kind": "domain"})
        authorization = authorization_status(proof)
        message = "Domain control verified."
        if authorization == "pending_review":
            message += " Authorization is awaiting review."
        return VerificationChallenge(status="verified", authorization=authorization, record_name=name, verified_at=proof["verified_at"], message=message)
    events.record(db, "verify_failed", user_id=user.id, ip=client_ip(request), subject=project["root_domain"],
                  detail={"project_id": project["id"], "records_seen": len(records)})
    return VerificationChallenge(status=status, authorization=authorization, record_name=name, expires_at=project.get("verification_expires_at"), verified_at=project.get("verified_at"),
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
    if denial := can_scan(db, project, user.id):
        events.record(db, "scan_denied", user_id=user.id, ip=client_ip(request), subject=project["root_domain"], detail={"reason": denial})
        raise HTTPException(status_code=403, detail=denial)
    active = db.table("scans").select("id").eq("project_id", project["id"]).in_("status", ["queued", "running"]).execute().data
    if active:
        raise HTTPException(status_code=409, detail=f"A scan is already in progress ({active[0]['id']})")
    limiter.check(f"scan:{user.id}", settings.scan_rate_limit_per_min)
    try:
        scan_id = db.rpc("queue_authorized_scan", {"p_project": project_id, "p_user": user.id}).execute().data
    except APIError as exc:
        if exc.message == "scan_active":
            raise HTTPException(status_code=409, detail="A scan is already in progress.") from None
        if exc.message == "scan_denied":
            message = "Scan authorization changed. Refresh this project before trying again."
            events.record(db, "scan_denied", user_id=user.id, ip=client_ip(request), subject=project["root_domain"], detail={"reason": message})
            raise HTTPException(status_code=403, detail=message) from None
        raise HTTPException(status_code=503, detail="Could not queue a scan. Try again.") from None
    add_event(db, scan_id, "Scan queued.")
    events.record(db, "scan_started", user_id=user.id, ip=client_ip(request), subject=project["root_domain"],
                  detail={"project_id": project["id"], "scan_id": scan_id})
    if settings.run_jobs_inline:
        from attacksurface.worker import process_scan

        background.add_task(process_scan, scan_id)
    return ScanCreated(scan_id=scan_id, status="queued", project_id=project["id"])
