// Admin portal client. Real mode calls /admin/* (ADMIN-PANEL.md §9); FastAPI enforces every rule.
// Demo mode serves the labelled sample store in src/mocks/adminFixtures.ts and never touches the API.
import { apiConfig, json, request } from "./api";
import {
  adminStore,
  mockAddBlock,
  mockCopy,
  mockDecide,
  mockRemoveBlock,
  mockRevoke,
  mockSetUserStatus,
} from "@/mocks/adminFixtures";
import type {
  AdminDomain,
  AdminMe,
  AdminOverview,
  AdminUserRow,
  AuditEntry,
  BlocklistEntry,
  Page,
  ReviewItem,
  SecurityEvent,
} from "./types";

const demo = <T,>(produce: () => T, ms = 200): Promise<T> =>
  new Promise((resolve, reject) =>
    setTimeout(() => {
      try {
        const value = produce();
        resolve(value === undefined ? value : mockCopy<T>(value));
      } catch (err) {
        reject(err);
      }
    }, ms),
  );

const page = <T,>(items: T[]): Page<T> => ({ items, next_cursor: null });

function query(params: Record<string, string | undefined>): string {
  const q = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  return q.toString() ? `?${q}` : "";
}

const RISK_ORDER = { high: 0, medium: 1 } as const;

export const adminApi = {
  me(): Promise<AdminMe> {
    if (apiConfig.USE_MOCKS) return demo(() => adminStore.me, 100);
    return request<AdminMe>("/admin/me");
  },
  overview(): Promise<AdminOverview> {
    if (apiConfig.USE_MOCKS) return demo(() => adminStore.overview);
    return request<AdminOverview>("/admin/overview");
  },

  // --- reviews
  reviews(params: { status?: "pending" | "approved" | "rejected"; kind?: "user" | "domain" } = {}): Promise<Page<ReviewItem>> {
    if (apiConfig.USE_MOCKS)
      return demo(() =>
        page(
          adminStore.reviews
            .filter((r) => (!params.status || r.status === params.status) && (!params.kind || r.kind === params.kind))
            .sort((a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level] || a.created_at.localeCompare(b.created_at)),
        ),
      );
    return request<Page<ReviewItem>>(`/admin/reviews${query(params)}`);
  },
  decide(id: string, decision: "approve" | "reject", reason: string): Promise<ReviewItem> {
    if (apiConfig.USE_MOCKS) return demo(() => mockDecide(id, decision, reason), 300);
    return request<ReviewItem>(`/admin/reviews/${id}/decision`, json("POST", { decision, reason }));
  },
  reanalyze(id: string): Promise<ReviewItem> {
    if (apiConfig.USE_MOCKS) return demo(() => adminStore.reviews.find((r) => r.id === id)!, 600);
    return request<ReviewItem>(`/admin/reviews/${id}/reanalyze`, { method: "POST" });
  },

  // --- users
  users(params: { q?: string; status?: string; risk?: string } = {}): Promise<Page<AdminUserRow>> {
    if (apiConfig.USE_MOCKS)
      return demo(() =>
        page(
          adminStore.users.filter(
            (u) =>
              (!params.q || (u.email ?? "").toLowerCase().includes(params.q.toLowerCase())) &&
              (!params.status || u.status === params.status) &&
              (!params.risk || u.risk_level === params.risk),
          ),
        ),
      );
    return request<Page<AdminUserRow>>(`/admin/users${query(params)}`);
  },
  suspend(id: string, reason: string) {
    if (apiConfig.USE_MOCKS) return demo(() => mockSetUserStatus(id, "suspended", reason), 300);
    return request<{ user_id: string; status: string; previous_status: string | null }>(`/admin/users/${id}/suspend`, json("POST", { reason }));
  },
  unsuspend(id: string, reason: string) {
    if (apiConfig.USE_MOCKS) return demo(() => mockSetUserStatus(id, "active", reason), 300);
    return request<{ user_id: string; status: string; previous_status: string | null }>(`/admin/users/${id}/unsuspend`, json("POST", { reason }));
  },

  // --- domains
  domains(params: { status?: string } = {}): Promise<Page<AdminDomain>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.domains.filter((d) => !params.status || d.authorization === params.status)));
    return request<Page<AdminDomain>>(`/admin/domains${query(params)}`);
  },
  revoke(projectId: string, reason: string): Promise<AdminDomain> {
    if (apiConfig.USE_MOCKS) return demo(() => mockRevoke(projectId, reason), 300);
    return request<AdminDomain>(`/admin/domains/${projectId}/revoke`, json("POST", { reason }));
  },
  recheck(projectId: string): Promise<{ found: boolean; checked_at: string }> {
    if (apiConfig.USE_MOCKS)
      return demo(() => ({ found: adminStore.domains.find((d) => d.project_id === projectId)?.dns_proof === "verified", checked_at: new Date().toISOString() }), 700);
    return request(`/admin/domains/${projectId}/recheck`, { method: "POST" });
  },

  // --- events, blocklist, audit
  events(params: { type?: string } = {}): Promise<Page<SecurityEvent>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.events.filter((e) => !params.type || e.type === params.type)));
    return request<Page<SecurityEvent>>(`/admin/events${query(params)}`);
  },
  blocklist(): Promise<Page<BlocklistEntry>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.blocklist));
    return request<Page<BlocklistEntry>>("/admin/blocklist");
  },
  addBlock(pattern: string, match: "exact" | "suffix", reason: string): Promise<BlocklistEntry> {
    if (apiConfig.USE_MOCKS) return demo(() => mockAddBlock(pattern, match, reason), 300);
    return request<BlocklistEntry>("/admin/blocklist", json("POST", { pattern, match, reason }));
  },
  removeBlock(pattern: string, reason: string): Promise<void> {
    if (apiConfig.USE_MOCKS) return demo(() => mockRemoveBlock(pattern, reason), 300);
    return request<void>(`/admin/blocklist${query({ pattern })}`, json("DELETE", { reason }));
  },
  audit(params: { action?: string } = {}): Promise<Page<AuditEntry>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.audit.filter((a) => !params.action || a.action.startsWith(params.action))));
    return request<Page<AuditEntry>>(`/admin/audit${query(params)}`);
  },
};
