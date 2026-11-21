from __future__ import annotations

from datetime import datetime
from typing import Literal

import pydantic
from pydantic import BaseModel, Field

Severity = Literal["critical", "high", "medium", "low", "info"]
Environment = Literal["prod", "staging", "dev", "unknown"]
AssetStatus = Literal["resolved", "unresolved"]
FindingSource = Literal["rules", "osv"]
ScanStatus = Literal["queued", "running", "completed", "failed"]
EventLevel = Literal["info", "warn", "error"]
Confidence = Literal["high", "medium", "low"]
NodeType = Literal["root", "asset", "finding", "fix"]


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1)
    root_domain: str = Field(min_length=1)
    authorization_confirmed: bool


class Project(BaseModel):
    id: str
    name: str
    root_domain: str
    authorization_confirmed: bool
    created_at: datetime


class ScanEvent(BaseModel):
    timestamp: datetime
    level: EventLevel
    message: str


class Scan(BaseModel):
    id: str
    status: ScanStatus
    started_at: datetime | None = None
    completed_at: datetime | None = None
    events: list[ScanEvent] = Field(default_factory=list)


class ScanCreated(BaseModel):
    scan_id: str


class Asset(BaseModel):
    id: str
    hostname: str
    ip_addresses: list[str]
    technology: str
    https: bool
    environment: Environment
    status: AssetStatus
    last_seen: datetime


class Advisory(BaseModel):
    id: str
    summary: str
    severity: Severity
    references: list[str] = Field(default_factory=list)


class Finding(BaseModel):
    id: str
    asset_id: str
    type: str
    title: str
    severity: Severity
    evidence: str
    remediation: str
    source: FindingSource
    references: list[str] = Field(default_factory=list)


class Dependency(BaseModel):
    id: str
    package_name: str
    version: str
    ecosystem: str
    direct: bool
    advisories: list[Advisory] = Field(default_factory=list)
    fixed_version: str | None = None


class AnalysisFinding(BaseModel):
    finding_id: str
    summary: str
    why_it_matters: str
    business_impact: str
    remediation: str
    suggested_priority: str
    confidence: Confidence
    evidence_refs: list[str] = Field(default_factory=list)


class Analysis(BaseModel):
    executive_summary: str
    findings: list[AnalysisFinding] = Field(default_factory=list)


class GraphNode(BaseModel):
    id: str
    type: NodeType
    label: str
    severity: Severity | None = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str


class Graph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]


class Health(BaseModel):
    status: Literal["ok"]


class SignUpModel(BaseModel):
    email: str
    password: str


class SignInModel(BaseModel):
    email: str
    password: str


class ClientApiDocs(BaseModel):
    file_contents: str | None
