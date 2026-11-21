export type Severity = "critical" | "high" | "medium" | "low" | "info";

export interface Project {
  id: string;
  name: string;
  root_domain: string;
  authorization_confirmed: boolean;
  created_at: string;
}

export interface ProjectCreate {
  name: string;
  root_domain: string;
  authorization_confirmed: boolean;
}

export interface ScanEvent {
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
}

export interface Scan {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  started_at: string | null;
  completed_at: string | null;
  events: ScanEvent[];
}

export interface ScanCreated {
  scan_id: string;
}

export interface Asset {
  id: string;
  hostname: string;
  ip_addresses: string[];
  technology: string;
  https: boolean;
  environment: "prod" | "staging" | "dev" | "unknown";
  status: "resolved" | "unresolved";
  last_seen: string;
}

export interface Advisory {
  id: string;
  summary: string;
  severity: Severity;
  references: string[];
}

export interface Finding {
  id: string;
  asset_id: string;
  type: string;
  title: string;
  severity: Severity;
  evidence: string;
  remediation: string;
  source: "rules" | "osv";
  references: string[];
}

export interface Dependency {
  id: string;
  package_name: string;
  version: string;
  ecosystem: string;
  direct: boolean;
  advisories: Advisory[];
  fixed_version: string | null;
}

export interface AnalysisFinding {
  finding_id: string;
  summary: string;
  why_it_matters: string;
  business_impact: string;
  remediation: string;
  suggested_priority: string;
  confidence: "high" | "medium" | "low";
  evidence_refs: string[];
}

export interface Analysis {
  executive_summary: string;
  findings: AnalysisFinding[];
}

export interface GraphNode {
  id: string;
  type: "root" | "asset" | "finding" | "fix";
  label: string;
  severity?: Severity;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
}

export interface Graph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface Health {
  status: "ok";
}
