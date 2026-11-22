import { fixtures } from "@/mocks/fixtures";
import { DEMO_PROJECT_ID, DEMO_SCAN_ID } from "./constants";
import { session } from "./session";
import type {
  Analysis,
  Asset,
  AuthSession,
  AuthUser,
  Dependency,
  Evidence,
  Finding,
  Graph,
  MfaEnrollment,
  MfaFactor,
  Project,
  ProjectCreate,
  Scan,
  ScanCreated,
  SignUpResult,
  VerificationChallenge,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
// Demo mode is explicit: only VITE_USE_MOCKS=true serves the labelled acme-demo fixtures.
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));
const clone = <T,>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;

let refreshing: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const current = session.get();
  if (!current?.refresh_token) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: current.refresh_token }),
  })
    .then(async (r) => {
      if (!r.ok) return false;
      session.set((await r.json()) as AuthSession);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

export async function request<T>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
  const token = session.get()?.access_token;
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });

  if (response.status === 401 && token && !retried) {
    if (await refreshSession()) return request<T>(path, init, true);
    session.set(null); // expired for good: the router sends the user to sign in
  }
  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as { detail?: unknown };
      detail = typeof json.detail === "string" ? json.detail : Array.isArray(json.detail) ? "Please check the form and try again." : text;
    } catch {
      // not JSON
    }
    throw new ApiError(detail || `Request failed (${response.status})`, response.status);
  }
  if (response.status === 204) return undefined as T;
  const type = response.headers.get("content-type") || "";
  return (type.includes("text/markdown") || type.includes("text/plain") ? await response.text() : await response.json()) as T;
}

export const json = (method: string, body?: unknown): RequestInit => ({ method, body: body === undefined ? undefined : JSON.stringify(body) });

const demoProject = (): Project => ({
  ...clone<Project>(fixtures.project),
  verification_status: "verified",
  authorization: "approved",
  verified_at: fixtures.project.created_at,
  latest_scan_id: DEMO_SCAN_ID,
});

export const api = {
  // --- auth
  signUp: (email: string, password: string) => request<SignUpResult>("/auth/signup", json("POST", { email, password })),
  signIn: (email: string, password: string) => request<AuthSession>("/auth/signin", json("POST", { email, password })),
  signOut: () => request<void>("/auth/signout", { method: "POST" }).catch(() => undefined),
  me: (): Promise<AuthUser> =>
    USE_MOCKS ? delay().then(() => ({ id: "demo-user", email: null, status: "active", aal: "aal1" as const })) : request<AuthUser>("/auth/me"),

  // --- two-factor
  async mfaFactors(): Promise<MfaFactor[]> {
    if (USE_MOCKS) return [];
    return request<MfaFactor[]>("/auth/mfa/factors");
  },
  async mfaEnroll(): Promise<MfaEnrollment> {
    if (USE_MOCKS) throw new ApiError("Two-factor isn't available in demo mode", 400);
    return request<MfaEnrollment>("/auth/mfa/enroll", { method: "POST" });
  },
  async mfaVerify(factorId: string, code: string): Promise<AuthSession> {
    if (USE_MOCKS) throw new ApiError("Two-factor isn't available in demo mode", 400);
    const next = await request<AuthSession>("/auth/mfa/verify", json("POST", { factor_id: factorId, code }));
    session.set(next); // only reached on success: a wrong code leaves the current session as it was
    return next;
  },

  // --- projects
  async listProjects(): Promise<Project[]> {
    if (USE_MOCKS) return delay().then(() => [demoProject()]);
    return request<Project[]>("/projects");
  },
  async getProject(id: string): Promise<Project> {
    if (USE_MOCKS) return delay().then(() => ({ ...demoProject(), id }));
    return request<Project>(`/projects/${id}`);
  },
  async createProject(payload: ProjectCreate): Promise<Project> {
    if (USE_MOCKS) {
      await delay();
      if (!payload.authorization_confirmed) throw new ApiError("authorization_confirmed must be true before creating a project", 400);
      return { ...demoProject(), name: payload.name, root_domain: payload.root_domain };
    }
    return request<Project>("/projects", json("POST", payload));
  },
  issueVerification: (projectId: string) => request<VerificationChallenge>(`/projects/${projectId}/verification`, { method: "POST" }),
  checkVerification: (projectId: string) => request<VerificationChallenge>(`/projects/${projectId}/verification/check`, { method: "POST" }),

  // --- scans
  async listScans(projectId: string): Promise<Scan[]> {
    if (USE_MOCKS) return delay().then(() => [{ ...clone<Scan>(fixtures.scan), id: DEMO_SCAN_ID }]);
    return request<Scan[]>(`/projects/${projectId}/scans`);
  },
  async createScan(projectId: string): Promise<ScanCreated> {
    if (USE_MOCKS) return delay().then(() => ({ scan_id: DEMO_SCAN_ID, status: "queued" as const, project_id: projectId || DEMO_PROJECT_ID }));
    return request<ScanCreated>(`/projects/${projectId}/scans`, { method: "POST" });
  },
  async getScan(scanId: string): Promise<Scan> {
    if (USE_MOCKS) return delay().then(() => ({ ...clone<Scan>(fixtures.scan), id: scanId }));
    return request<Scan>(`/scans/${scanId}`);
  },
  cancelScan: (scanId: string) => request<Scan>(`/scans/${scanId}/cancel`, { method: "POST" }),
  async getScanAssets(scanId: string): Promise<Asset[]> {
    if (USE_MOCKS) return delay().then(() => clone<Asset[]>(fixtures.assets));
    return request<Asset[]>(`/scans/${scanId}/assets`);
  },
  async getScanFindings(scanId: string): Promise<Finding[]> {
    if (USE_MOCKS) return delay().then(() => clone<Finding[]>(fixtures.findings));
    return request<Finding[]>(`/scans/${scanId}/findings`);
  },
  async getScanEvidence(scanId: string): Promise<Evidence[]> {
    if (USE_MOCKS) return delay().then(() => []);
    return request<Evidence[]>(`/scans/${scanId}/evidence`);
  },

  // --- dependencies
  async uploadDependencies(projectId: string, file: File, deployedOn?: string): Promise<Dependency[]> {
    if (USE_MOCKS) return delay(400).then(() => clone<Dependency[]>(fixtures.dependencies));
    const form = new FormData();
    form.append("file", file);
    if (deployedOn) form.append("deployed_on", deployedOn);
    return request<Dependency[]>(`/projects/${projectId}/dependencies`, { method: "POST", body: form });
  },
  async getDependencies(projectId: string): Promise<Dependency[]> {
    if (USE_MOCKS) return delay().then(() => clone<Dependency[]>(fixtures.dependencies));
    return request<Dependency[]>(`/projects/${projectId}/dependencies`);
  },

  // --- graph, analysis, report
  async getGraph(scanId: string): Promise<Graph> {
    if (USE_MOCKS) return delay().then(() => clone<Graph>(fixtures.graph));
    return request<Graph>(`/scans/${scanId}/graph`);
  },
  async getAnalysis(scanId: string): Promise<Analysis | null> {
    if (USE_MOCKS) return delay().then(() => ({ ...clone<Analysis>(fixtures.analysis), status: "completed" as const, source: "fallback" as const }));
    try {
      return await request<Analysis>(`/scans/${scanId}/analysis`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null; // not requested yet
      throw err;
    }
  },
  async requestAnalysis(scanId: string): Promise<Analysis> {
    if (USE_MOCKS) return delay(500).then(() => ({ ...clone<Analysis>(fixtures.analysis), status: "completed" as const }));
    return request<Analysis>(`/scans/${scanId}/analyze`, { method: "POST" });
  },
  async getReport(scanId: string): Promise<string> {
    if (USE_MOCKS) return delay().then(() => String(fixtures.report));
    return request<string>(`/scans/${scanId}/report.md`);
  },
  updateAssetEnvironment: (assetId: string, environment: Asset["environment"]) =>
    request<Asset>(`/assets/${assetId}`, json("PATCH", { environment })),
};

export const apiConfig = { API_URL, USE_MOCKS };
