export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type Environment = "prod" | "staging" | "dev" | "unknown";
export type VerificationStatus = "unverified" | "pending" | "verified" | "expired";
export type ScanStatus = "queued" | "running" | "completed" | "partial" | "failed" | "cancelled";
export type Priority = "P0" | "P1" | "P2" | "P3";

export interface AuthUser {
  id: string;
  email: string | null;
  // Optional: sessions saved before the admin portal don't carry them; /auth/me always does.
  status?: string;
  aal?: "aal1" | "aal2";
}

export interface MfaFactor {
  id: string;
  status: "verified" | "unverified";
  factor_type: string;
}

export interface MfaEnrollment {
  factor_id: string;
  qr_code: string;
  secret: string;
  uri: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_at: number | null;
  token_type: string;
  user: AuthUser;
}

export interface SignUpResult {
  user: AuthUser;
  session: AuthSession | null;
  message: string;
}

export interface Project {
  id: string;
  name: string;
  root_domain: string;
  authorization_confirmed: boolean;
  created_at: string;
  verification_status: VerificationStatus;
  verified_at: string | null;
  latest_scan_id: string | null;
}

export interface ProjectCreate {
  name: string;
  root_domain: string;
  authorization_confirmed: boolean;
}

export interface VerificationChallenge {
  status: VerificationStatus;
  record_type: "TXT";
  record_name: string;
  record_value: string | null;
  expires_at: string | null;
  verified_at: string | null;
  message: string;
}

export interface ScanEvent {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface Scan {
  id: string;
  project_id?: string | null;
  status: ScanStatus;
  started_at: string | null;
  completed_at: string | null;
  created_at?: string | null;
  error?: string | null;
  events: ScanEvent[];
}

export interface ScanCreated {
  scan_id: string;
  status: ScanStatus;
  project_id: string;
}

export interface Asset {
  id: string;
  hostname: string;
  ip_addresses: string[];
  technology: string | null;
  https: boolean;
  environment: Environment;
  environment_source?: "heuristic" | "user";
  environment_confidence?: "high" | "medium" | "low";
  status: "resolved" | "unresolved";
  last_seen: string;
  dns?: Record<string, unknown>;
  http?: Record<string, unknown>;
  tls?: Record<string, unknown>;
}

export interface Advisory {
  id: string;
  summary: string;
  severity: Severity | null;
  references: string[];
  aliases?: string[];
}

export interface Finding {
  id: string;
  asset_id: string | null;
  type: string;
  rule_id?: string | null;
  title: string;
  description?: string | null;
  severity: Severity;
  confidence?: "high" | "medium" | "low";
  evidence: string;
  remediation: string;
  source: "rules" | "osv";
  references: string[];
  evidence_ids?: string[];
  advisory_id?: string | null;
}

export interface Evidence {
  id: string;
  kind: string;
  source: string;
  asset_id: string | null;
  data: Record<string, unknown>;
  collected_at: string;
}

export interface Dependency {
  id: string;
  package_name: string;
  version: string;
  ecosystem: string;
  direct: boolean;
  resolved?: boolean;
  advisories: Advisory[];
  fixed_version: string | null;
  deployed_on?: string | null;
}

export interface AnalysisFinding {
  finding_id: string;
  summary: string;
  why_it_matters: string;
  business_impact: string;
  remediation: string;
  suggested_priority: Priority | string;
  confidence: "high" | "medium" | "low";
  evidence_refs: string[];
}

export interface Analysis {
  id?: string | null;
  status?: "queued" | "running" | "completed" | "failed";
  source?: "gemini" | "fallback" | null;
  model?: string | null;
  executive_summary: string;
  findings: AnalysisFinding[];
  missing_evidence?: string[];
  validation_errors?: string[];
  error?: string | null;
}

export interface GraphNode {
  id: string;
  type: "root" | "asset" | "dependency" | "finding" | "fix";
  label: string;
  severity?: Severity | null;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation?: string | null;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Health {
  status: "ok";
}

// --- admin portal (contract: ADMIN-PANEL.md §9) ---------------------------------------------

export type AdminRole = "viewer" | "operator";
export type RiskLevel = "low" | "medium" | "high";

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface AdminMe {
  id: string;
  email: string | null;
  role: AdminRole;
  aal: "aal1" | "aal2";
  mfa_required: boolean;
}

export interface AdminOverview {
  users: number;
  verified_domains: number;
  pending_reviews: number;
  scans_24h: number;
  scan_failures_24h: number;
  blocklist_hits_24h: number;
  ai_fallback_rate: number | null;
  worker_last_seen: string | null;
  daily_brief: { text: string; source: "gemini" | "template" };
}

export interface AiVerdict {
  recommendation: "approve" | "reject" | "needs_more_info";
  confidence: "low" | "medium" | "high";
  summary: string;
  key_signals: string[];
  missing_information: string[];
  model: string | null;
  fallback_used: boolean;
}

export interface ReviewSignal {
  id: string;
  label: string;
  value: string;
}

export interface ReviewItem {
  id: string;
  kind: "user" | "domain";
  status: "pending" | "approved" | "rejected";
  risk_level: "medium" | "high";
  user_id: string;
  user_email: string | null;
  project_id: string | null;
  root_domain: string | null;
  signals: ReviewSignal[];
  ai_verdict: AiVerdict | null;
  created_at: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
}

export interface AdminUserRow {
  id: string;
  email: string | null;
  status: "active" | "pending_review" | "suspended";
  risk_level: RiskLevel;
  risk_reasons: string[];
  created_at: string;
  last_seen: string | null;
  projects: number;
}

export type DomainAuthorization = "not_routed" | "auto_cleared" | "pending_review" | "approved" | "rejected" | "revoked";

export interface AdminDomain {
  project_id: string;
  root_domain: string;
  owner_id: string;
  owner_email: string | null;
  dns_proof: "unverified" | "pending" | "verified" | "expired";
  authorization: DomainAuthorization;
  verified_at: string | null;
  risk_level: RiskLevel | null;
}

export interface SecurityEvent {
  id: number;
  type: string;
  user_id: string | null;
  user_email: string | null;
  ip: string | null;
  subject: string | null;
  detail: Record<string, unknown>;
  created_at: string;
}

export interface BlocklistEntry {
  pattern: string;
  match: "exact" | "suffix";
  reason: string;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: string;
  reason: string | null;
  created_at: string;
}
