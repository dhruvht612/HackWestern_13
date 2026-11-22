from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

DomainAuthorization = Literal["not_routed", "auto_cleared", "pending_review", "approved", "rejected", "revoked"]
Severity = Literal["critical", "high", "medium", "low", "info"]
Environment = Literal["prod", "staging", "dev", "unknown"]
AssetStatus = Literal["resolved", "unresolved"]
FindingSource = Literal["rules", "osv"]
ScanStatus = Literal["queued", "running", "completed", "partial", "failed", "cancelled"]
EventLevel = Literal["info", "warn", "error"]
Confidence = Literal["high", "medium", "low"]
Priority = Literal["P0", "P1", "P2", "P3"]
NodeType = Literal["root", "asset", "dependency", "finding", "fix"]
EdgeRelation = Literal["contains", "resolves_to", "deployed_on", "affected_by", "remediated_by"]
VerificationStatus = Literal["unverified", "pending", "verified", "expired"]
AnalysisStatus = Literal["queued", "running", "completed", "failed"]
AnalysisSource = Literal["gemini", "fallback"]


# --- Auth ---------------------------------------------------------------------------------


class SignUpModel(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class SignInModel(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshModel(BaseModel):
    refresh_token: str = Field(min_length=1)


class AuthUser(BaseModel):
    id: str
    email: str | None = None
    status: str = "active"
    aal: str = "aal1"


class AuthSession(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: int | None = None
    token_type: str = "bearer"
    user: AuthUser


class SignUpResult(BaseModel):
    user: AuthUser
    session: AuthSession | None = None
    message: str


# --- Projects -----------------------------------------------------------------------------


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    root_domain: str = Field(min_length=1, max_length=253)
    authorization_confirmed: bool


class Project(BaseModel):
    id: str
    name: str
    root_domain: str
    authorization_confirmed: bool
    created_at: datetime
    verification_status: VerificationStatus = "unverified"
    authorization: DomainAuthorization = "not_routed"
    verified_at: datetime | None = None
    latest_scan_id: str | None = None


class VerificationChallenge(BaseModel):
    status: VerificationStatus
    authorization: DomainAuthorization = "not_routed"
    record_type: Literal["TXT"] = "TXT"
    record_name: str
    record_value: str | None = None  # only returned when a new challenge is issued
    expires_at: datetime | None = None
    verified_at: datetime | None = None
    message: str


# --- Scans --------------------------------------------------------------------------------


class ScanEvent(BaseModel):
    timestamp: datetime
    level: EventLevel
    message: str


class Scan(BaseModel):
    id: str
    project_id: str | None = None
    status: ScanStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime | None = None
    error: str | None = None
    events: list[ScanEvent] = Field(default_factory=list)


class ScanCreated(BaseModel):
    scan_id: str
    status: ScanStatus
    project_id: str


class Asset(BaseModel):
    id: str
    hostname: str
    ip_addresses: list[str]
    technology: str | None = None
    https: bool
    environment: Environment
    environment_source: Literal["heuristic", "user"] = "heuristic"
    environment_confidence: Confidence = "low"
    status: AssetStatus
    last_seen: datetime
    dns: dict[str, Any] = Field(default_factory=dict)
    http: dict[str, Any] = Field(default_factory=dict)
    tls: dict[str, Any] = Field(default_factory=dict)


class AssetUpdate(BaseModel):
    environment: Environment


class Advisory(BaseModel):
    id: str
    summary: str
    severity: Severity | None = None  # None when OSV publishes no severity; never guessed
    references: list[str] = Field(default_factory=list)
    aliases: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    id: str
    asset_id: str | None = None
    type: str
    rule_id: str | None = None
    title: str
    description: str | None = None
    severity: Severity
    confidence: Confidence = "medium"
    evidence: str
    remediation: str
    source: FindingSource
    references: list[str] = Field(default_factory=list)
    evidence_ids: list[str] = Field(default_factory=list)
    dependency_id: str | None = None
    advisory_id: str | None = None


class Evidence(BaseModel):
    id: str
    kind: str
    source: str
    asset_id: str | None = None
    data: dict[str, Any] = Field(default_factory=dict)
    collected_at: datetime


class Dependency(BaseModel):
    id: str
    package_name: str
    version: str
    ecosystem: str
    direct: bool
    resolved: bool = True
    advisories: list[Advisory] = Field(default_factory=list)
    fixed_version: str | None = None
    deployed_on: str | None = None
    asset_id: str | None = None


# --- Analysis -----------------------------------------------------------------------------


class AnalysisFinding(BaseModel):
    finding_id: str
    summary: str
    why_it_matters: str
    business_impact: str
    remediation: str
    suggested_priority: Priority
    confidence: Confidence
    evidence_refs: list[str] = Field(default_factory=list)


class AnalystOutput(BaseModel):
    """What the model must return (and what the fallback produces)."""

    executive_summary: str
    findings: list[AnalysisFinding] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)


class Analysis(AnalystOutput):
    id: str | None = None
    scan_id: str | None = None
    status: AnalysisStatus = "completed"
    source: AnalysisSource | None = None
    model: str | None = None
    prompt_version: str | None = None
    validation_errors: list[str] = Field(default_factory=list)
    error: str | None = None
    generated_at: datetime | None = None


# --- Graph --------------------------------------------------------------------------------


class GraphNode(BaseModel):
    id: str
    type: NodeType
    label: str
    severity: Severity | None = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relation: EdgeRelation | None = None


class Graph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class Health(BaseModel):
    status: Literal["ok"]


class ClientApiDocs(BaseModel):
    """An uploaded API description (e.g. an OpenAPI file) stored on the project."""

    file_contents: str | None = Field(default=None, max_length=1_000_000)


# --- admin -------------------------------------------------------------------------------


class AdminMe(BaseModel):
    id: str
    email: str | None = None
    role: Literal["viewer", "operator"]
    aal: str
    mfa_required: bool


class ReasonModel(BaseModel):
    reason: str = Field(max_length=500)

    @field_validator("reason")
    @classmethod
    def _meaningful(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 5:
            raise ValueError("Give a reason of at least 5 characters.")
        return value


class UserStatusChange(BaseModel):
    user_id: str
    status: Literal["active", "suspended"]
    previous_status: str | None = None


class AdminPage[T](BaseModel):
    items: list[T]
    next_cursor: str | None


class AdminUserRow(BaseModel):
    id: str
    email: str | None
    status: Literal["active", "pending_review", "suspended"]
    risk_level: Literal["low", "medium", "high"]
    risk_reasons: list[str]
    created_at: datetime
    last_seen: datetime | None
    projects: int


class AdminSecurityEvent(BaseModel):
    id: int
    type: str
    user_id: str | None
    user_email: str | None
    ip: str | None
    subject: str | None
    detail: dict[str, Any]
    created_at: datetime


class AdminAuditEntry(BaseModel):
    id: int
    actor_id: str | None
    actor_email: str | None
    action: str
    target_type: str
    target_id: str
    reason: str | None
    created_at: datetime


class AdminDailyBrief(BaseModel):
    text: str
    source: Literal["gemini", "template"]


class AdminOverview(BaseModel):
    users: int
    verified_domains: int
    pending_reviews: int
    scans_24h: int
    scan_failures_24h: int
    blocklist_hits_24h: int
    ai_fallback_rate: float | None
    worker_last_seen: datetime | None
    daily_brief: AdminDailyBrief


class ReviewDecision(ReasonModel):
    decision: Literal["approve", "reject"]


class ReviewSignal(BaseModel):
    id: str
    label: str
    value: str


class ReviewAdvice(BaseModel):
    recommendation: Literal["approve", "reject", "needs_more_info"]
    confidence: Literal["low", "medium", "high"]
    summary: str = Field(max_length=500)
    key_signals: list[str] = Field(max_length=10)
    missing_information: list[str] = Field(max_length=5)


class ReviewVerdict(ReviewAdvice):
    model: str | None
    fallback_used: bool


class AdminReview(BaseModel):
    id: str
    kind: Literal["user", "domain"]
    status: Literal["pending", "approved", "rejected"]
    risk_level: Literal["medium", "high"]
    user_id: str
    user_email: str | None
    project_id: str | None
    root_domain: str | None
    signals: list[ReviewSignal]
    ai_verdict: ReviewVerdict | None
    created_at: datetime
    decided_by: str | None
    decided_at: datetime | None
    decision_reason: str | None


class AdminReviewDetail(AdminReview):
    recent_events: list[AdminSecurityEvent]


class AdminDomain(BaseModel):
    project_id: str
    root_domain: str
    owner_id: str | None
    owner_email: str | None
    dns_proof: VerificationStatus
    authorization: DomainAuthorization
    verified_at: datetime | None
    risk_level: Literal["low", "medium", "high"] | None


class AdminUserDetail(AdminUserRow):
    claims: list[AdminDomain]
    recent_events: list[AdminSecurityEvent]


class DnsRecheck(BaseModel):
    found: bool
    checked_at: datetime


class BlockPattern(ReasonModel):
    pattern: str = Field(min_length=1, max_length=254)
    match: Literal["exact", "suffix"]


class AdminBlock(BaseModel):
    pattern: str
    match: Literal["exact", "suffix"]
    reason: str
    created_at: datetime


# --- two-factor --------------------------------------------------------------------------


class MfaFactor(BaseModel):
    id: str
    status: str
    factor_type: str


class MfaEnrollment(BaseModel):
    factor_id: str
    qr_code: str
    secret: str
    uri: str


class MfaVerifyModel(BaseModel):
    factor_id: str = Field(min_length=1, max_length=100)
    code: str = Field(pattern=r"^\d{6}$")
