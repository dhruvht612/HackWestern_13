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
