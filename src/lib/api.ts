import { fixtures } from "@/mocks/fixtures";
import type {
  Analysis,
  Asset,
  Dependency,
  Finding,
  Graph,
  Health,
  Project,
  ProjectCreate,
  Scan,
  ScanCreated,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";

const delay = (ms = 250) => new Promise((resolve) => setTimeout(resolve, ms));

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const json = JSON.parse(text) as { detail?: string };
      detail = json.detail || text;
    } catch {
      // ignore
    }
    throw new Error(detail || `Request failed: ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("text/markdown") || contentType.includes("text/plain")) {
    return (await response.text()) as T;
  }
  return (await response.json()) as T;
}

function mockClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const api = {
  async getHealth(): Promise<Health> {
    if (USE_MOCKS) {
      await delay();
      return mockClone(fixtures.health as Health);
    }
    return request<Health>("/health");
  },

  async listProjects(): Promise<Project[]> {
    if (USE_MOCKS) {
      await delay();
      return mockClone(fixtures.projects as Project[]);
    }
    return request<Project[]>("/projects");
  },

  async getProject(id: string): Promise<Project> {
    if (USE_MOCKS) {
      await delay();
      return { ...(mockClone(fixtures.project) as Project), id };
    }
    return request<Project>(`/projects/${id}`);
  },

  async createProject(payload: ProjectCreate): Promise<Project> {
    if (USE_MOCKS) {
      await delay();
      if (!payload.authorization_confirmed) {
        throw new Error("authorization_confirmed must be true before creating a project");
      }
      return {
        ...(mockClone(fixtures.project) as Project),
        name: payload.name,
        root_domain: payload.root_domain,
        authorization_confirmed: payload.authorization_confirmed,
      };
    }
    return request<Project>("/projects", { method: "POST", body: JSON.stringify(payload) });
  },

  async createScan(projectId: string): Promise<ScanCreated> {
    if (USE_MOCKS) {
      await delay();
      void projectId;
      return mockClone(fixtures.scanCreated as ScanCreated);
    }
    return request<ScanCreated>(`/projects/${projectId}/scans`, { method: "POST" });
  },

  async getScan(scanId: string): Promise<Scan> {
    if (USE_MOCKS) {
      await delay();
      return { ...(mockClone(fixtures.scan) as Scan), id: scanId };
    }
    return request<Scan>(`/scans/${scanId}`);
  },

  async getScanAssets(scanId: string): Promise<Asset[]> {
    if (USE_MOCKS) {
      await delay();
      void scanId;
      return mockClone(fixtures.assets as Asset[]);
    }
    return request<Asset[]>(`/scans/${scanId}/assets`);
  },

  async getScanFindings(scanId: string): Promise<Finding[]> {
    if (USE_MOCKS) {
      await delay();
      void scanId;
      return mockClone(fixtures.findings as Finding[]);
    }
    return request<Finding[]>(`/scans/${scanId}/findings`);
  },

  async uploadDependencies(projectId: string, file: File): Promise<Dependency[]> {
    if (USE_MOCKS) {
      await delay(400);
      void projectId;
      void file;
      return mockClone(fixtures.dependencies as Dependency[]);
    }
    const form = new FormData();
    form.append("file", file);
    return request<Dependency[]>(`/projects/${projectId}/dependencies`, {
      method: "POST",
      body: form,
    });
  },

  async getDependencies(projectId: string): Promise<Dependency[]> {
    if (USE_MOCKS) {
      await delay();
      void projectId;
      return mockClone(fixtures.dependencies as Dependency[]);
    }
    return request<Dependency[]>(`/projects/${projectId}/dependencies`);
  },

  async getGraph(scanId: string): Promise<Graph> {
    if (USE_MOCKS) {
      await delay();
      void scanId;
      return mockClone(fixtures.graph as Graph);
    }
    return request<Graph>(`/scans/${scanId}/graph`);
  },

  async createAnalysis(scanId: string): Promise<Analysis> {
    if (USE_MOCKS) {
      await delay(500);
      void scanId;
      return mockClone(fixtures.analysis as Analysis);
    }
    return request<Analysis>(`/scans/${scanId}/analysis`, { method: "POST" });
  },

  async getReport(scanId: string): Promise<string> {
    if (USE_MOCKS) {
      await delay();
      void scanId;
      return String(fixtures.report);
    }
    return request<string>(`/scans/${scanId}/report.md`);
  },
};

export const apiConfig = { API_URL, USE_MOCKS };
