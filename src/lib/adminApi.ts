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
  AdminAiMetrics,
  AdminCopilotAnswer,
  AdminMe,
  AdminOverview,
  AdminReviewDetail,
  AdminUserDetail,
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
  reviews(params: { status?: "pending" | "approved" | "rejected" | "decided"; kind?: "user" | "domain"; cursor?: string } = {}): Promise<Page<ReviewItem>> {
    if (apiConfig.USE_MOCKS)
      return demo(() =>
        page(
          adminStore.reviews
            .filter((r) => (!params.status || r.status === params.status || (params.status === "decided" && r.status !== "pending")) && (!params.kind || r.kind === params.kind))
            .sort((a, b) => RISK_ORDER[a.risk_level] - RISK_ORDER[b.risk_level] || a.created_at.localeCompare(b.created_at)),
        ),
      );
    return request<Page<ReviewItem>>(`/admin/reviews${query(params)}`);
  },
  decide(id: string, decision: "approve" | "reject", reason: string): Promise<ReviewItem> {
    if (apiConfig.USE_MOCKS) return demo(() => mockDecide(id, decision, reason), 300);
    return request<ReviewItem>(`/admin/reviews/${id}/decision`, json("POST", { decision, reason }));
  },
  review(id: string): Promise<AdminReviewDetail> {
    if (apiConfig.USE_MOCKS) return demo(() => {
      const item = adminStore.reviews.find((r) => r.id === id)!;
      return { ...item, recent_events: adminStore.events.filter((e) => e.user_id === item.user_id) };
    });
    return request<AdminReviewDetail>(`/admin/reviews/${id}`);
  },
  reanalyze(id: string, reason: string): Promise<ReviewItem> {
    if (apiConfig.USE_MOCKS) return demo(() => adminStore.reviews.find((r) => r.id === id)!, 600);
    return request<ReviewItem>(`/admin/reviews/${id}/reanalyze`, json("POST", { reason }));
  },

  // --- users
  users(params: { q?: string; status?: string; risk?: string; cursor?: string } = {}): Promise<Page<AdminUserRow>> {
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
  user(id: string): Promise<AdminUserDetail> {
    if (apiConfig.USE_MOCKS) return demo(() => ({
      ...adminStore.users.find((u) => u.id === id)!,
      claims: adminStore.domains.filter((d) => d.owner_id === id),
      recent_events: adminStore.events.filter((e) => e.user_id === id),
    }));
    return request<AdminUserDetail>(`/admin/users/${id}`);
  },
  unsuspend(id: string, reason: string) {
    if (apiConfig.USE_MOCKS) return demo(() => mockSetUserStatus(id, "active", reason), 300);
    return request<{ user_id: string; status: string; previous_status: string | null }>(`/admin/users/${id}/unsuspend`, json("POST", { reason }));
  },

  // --- domains
  domains(params: { status?: string; cursor?: string } = {}): Promise<Page<AdminDomain>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.domains.filter((d) => !params.status || d.authorization === params.status)));
    return request<Page<AdminDomain>>(`/admin/domains${query(params)}`);
  },
  revoke(projectId: string, reason: string): Promise<AdminDomain> {
    if (apiConfig.USE_MOCKS) return demo(() => mockRevoke(projectId, reason), 300);
    return request<AdminDomain>(`/admin/domains/${projectId}/revoke`, json("POST", { reason }));
  },
  recheck(projectId: string, reason: string): Promise<{ found: boolean; checked_at: string }> {
    if (apiConfig.USE_MOCKS)
      return demo(() => ({ found: adminStore.domains.find((d) => d.project_id === projectId)?.dns_proof === "verified", checked_at: new Date().toISOString() }), 700);
    return request(`/admin/domains/${projectId}/recheck`, json("POST", { reason }));
  },

  // --- events, blocklist, audit
  events(params: { type?: string; cursor?: string } = {}): Promise<Page<SecurityEvent>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.events.filter((e) => !params.type || e.type === params.type)));
    return request<Page<SecurityEvent>>(`/admin/events${query(params)}`);
  },
  blocklist(cursor?: string): Promise<Page<BlocklistEntry>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.blocklist));
    return request<Page<BlocklistEntry>>(`/admin/blocklist${query({ cursor })}`);
  },
  addBlock(pattern: string, match: "exact" | "suffix", reason: string): Promise<BlocklistEntry> {
    if (apiConfig.USE_MOCKS) return demo(() => mockAddBlock(pattern, match, reason), 300);
    return request<BlocklistEntry>("/admin/blocklist", json("POST", { pattern, match, reason }));
  },
  removeBlock(pattern: string, reason: string): Promise<void> {
    if (apiConfig.USE_MOCKS) return demo(() => mockRemoveBlock(pattern, reason), 300);
    return request<void>(`/admin/blocklist${query({ pattern })}`, json("DELETE", { reason }));
  },
  audit(params: { action?: string; cursor?: string } = {}): Promise<Page<AuditEntry>> {
    if (apiConfig.USE_MOCKS) return demo(() => page(adminStore.audit.filter((a) => !params.action || a.action.startsWith(params.action))));
    return request<Page<AuditEntry>>(`/admin/audit${query(params)}`);
  },
  aiMetrics(): Promise<AdminAiMetrics> {
    if (apiConfig.USE_MOCKS) return demo(() => ({ active_model: null, prompt_version: "review-v1", purposes: [], errors: [], reanalyses: 0 }));
    return request<AdminAiMetrics>("/admin/ai/metrics");
  },
  ask(question: string): Promise<AdminCopilotAnswer> {
    if (apiConfig.USE_MOCKS) return demo(() => {
      const { users, verified_domains, pending_reviews, scans_24h, blocklist_hits_24h } = adminStore.overview;
      return {
        available: false,
        answer: "Copilot is unavailable in sample mode.",
        references: ["platform_stats:sample"],
        stats: { users, verified_domains, pending_reviews, scans_24h, blocklist_hits_24h },
      };
    });
    return request<AdminCopilotAnswer>("/admin/copilot", json("POST", { question }));
  },
};
