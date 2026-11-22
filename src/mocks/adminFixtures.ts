// Demo-mode admin data (VITE_USE_MOCKS=true only). A mutable copy of shared/fixtures/admin so
// approve, reject, suspend, revoke and blocklist changes visibly take effect, each with an audit
// row, the way the real Postgres functions do. Every name here is reserved (.test, .example).
import reviews from "../../shared/fixtures/admin/reviews.json";
import users from "../../shared/fixtures/admin/users.json";
import domains from "../../shared/fixtures/admin/domains.json";
import events from "../../shared/fixtures/admin/events.json";
import misc from "../../shared/fixtures/admin/misc.json";
import { ApiError } from "@/lib/api";
import type {
  AdminDomain,
  AdminMe,
  AdminOverview,
  AdminUserRow,
  AuditEntry,
  BlocklistEntry,
  ReviewItem,
  SecurityEvent,
} from "@/lib/types";

const copy = <T,>(value: unknown): T => JSON.parse(JSON.stringify(value)) as T;

export const adminStore = {
  me: copy<AdminMe>(misc.me),
  overview: copy<AdminOverview>(misc.overview),
  reviews: copy<ReviewItem[]>(reviews.items),
  users: copy<AdminUserRow[]>(users.items),
  domains: copy<AdminDomain[]>(domains.items),
  events: copy<SecurityEvent[]>(events.items),
  blocklist: copy<BlocklistEntry[]>(misc.blocklist.items),
  audit: copy<AuditEntry[]>(misc.audit.items),
};

const now = () => new Date().toISOString();

function audit(action: string, target_type: string, target_id: string, reason: string | null) {
  const id = Math.max(0, ...adminStore.audit.map((a) => a.id)) + 1;
  adminStore.audit.unshift({ id, actor_id: adminStore.me.id, actor_email: adminStore.me.email, action, target_type, target_id, reason, created_at: now() });
}

function refreshCounts() {
  adminStore.overview.pending_reviews = adminStore.reviews.filter((r) => r.status === "pending").length;
  adminStore.overview.verified_domains = adminStore.domains.filter((d) => d.dns_proof === "verified").length;
}

export function mockDecide(id: string, decision: "approve" | "reject", reason: string): ReviewItem {
  const item = adminStore.reviews.find((r) => r.id === id);
  if (!item) throw new ApiError("Review not found.", 404);
  if (item.status !== "pending") throw new ApiError("Someone else already decided this.", 409);
  if (item.user_id === adminStore.me.id) throw new ApiError("You can't decide a review about your own account or domains.", 403);
  Object.assign(item, { status: decision === "approve" ? "approved" : "rejected", decided_by: adminStore.me.id, decided_at: now(), decision_reason: reason });
  if (item.kind === "domain") {
    const domain = adminStore.domains.find((d) => d.project_id === item.project_id);
    if (domain) domain.authorization = decision === "approve" ? "approved" : "rejected";
  } else {
    const user = adminStore.users.find((u) => u.id === item.user_id);
    if (user) user.status = decision === "approve" ? "active" : "suspended";
  }
  audit(`review.${decision}`, item.kind === "domain" ? "project" : "user", item.project_id ?? item.user_id, reason);
  refreshCounts();
  return copy<ReviewItem>(item);
}

export function mockSetUserStatus(id: string, status: "active" | "suspended", reason: string) {
  if (id === adminStore.me.id) throw new ApiError("You can't change your own account.", 403);
  const user = adminStore.users.find((u) => u.id === id);
  if (!user) throw new ApiError("User not found.", 404);
  const previous_status = user.status;
  user.status = status;
  audit(status === "suspended" ? "user.suspend" : "user.unsuspend", "user", id, reason);
  return { user_id: id, status, previous_status };
}

export function mockRevoke(projectId: string, reason: string): AdminDomain {
  const domain = adminStore.domains.find((d) => d.project_id === projectId);
  if (!domain) throw new ApiError("Domain not found.", 404);
  domain.authorization = "revoked";
  audit("domain.revoke", "project", projectId, reason);
  return copy<AdminDomain>(domain);
}

export function mockAddBlock(pattern: string, match: "exact" | "suffix", reason: string): BlocklistEntry {
  const clean = pattern.trim().toLowerCase().replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*$/.test(clean)) throw new ApiError("Enter a domain like example.test (no scheme, path, or wildcard).", 422);
  if (adminStore.blocklist.some((b) => b.pattern === clean)) throw new ApiError("That pattern is already blocked.", 409);
  const entry: BlocklistEntry = { pattern: clean, match, reason, created_at: now() };
  adminStore.blocklist.unshift(entry);
  audit("blocklist.add", "blocklist", clean, reason);
  return entry;
}

export function mockRemoveBlock(pattern: string, reason: string) {
  const before = adminStore.blocklist.length;
  adminStore.blocklist = adminStore.blocklist.filter((b) => b.pattern !== pattern);
  if (adminStore.blocklist.length === before) throw new ApiError("Pattern not found.", 404);
  audit("blocklist.remove", "blocklist", pattern, reason);
}

export const mockCopy = copy;
