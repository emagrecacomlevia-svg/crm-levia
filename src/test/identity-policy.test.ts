import { describe, expect, it } from "vitest";
import {
  AUDIT_EVENT_TYPES,
  CAPABILITIES,
  canAccess,
  canIssueGrant,
  isAuditEventType,
  type AdminAccount,
  type PermissionGrant,
} from "@/modules/identity/domain/permissions";

const user = "synthetic-user";
const account: AdminAccount = { authUserId: user, isEnabled: true, disabledAt: null };
const grant: PermissionGrant = {
  subjectUserId: user,
  capabilityCode: "crm.read",
  scopeKind: "resource",
  scopeKey: "crm:team-a",
  validFrom: "2026-01-01T00:00:00Z",
  validUntil: null,
  revokedAt: null,
};
const now = new Date("2026-10-25T12:00:00Z");
function allowed(change: Partial<Parameters<typeof canAccess>[0]> = {}) {
  return canAccess({
    verifiedUserId: user,
    account,
    grants: [grant],
    capability: "crm.read",
    scopeKind: "resource",
    scopeKey: "crm:team-a",
    now,
    ...change,
  });
}

describe("HUB-04 strict deny-by-default domain policy", () => {
  it("defines precisely nine capabilities and the six audit event types", () => {
    expect(CAPABILITIES).toHaveLength(9);
    expect(new Set(CAPABILITIES).size).toBe(9);
    expect(AUDIT_EVENT_TYPES).toHaveLength(6);
    expect(isAuditEventType("grant_revoked")).toBe(true);
    expect(isAuditEventType("admin_all_access")).toBe(false);
  });
  it("accepts only exact active grants from a trusted account", () => {
    expect(allowed()).toBe(true);
    expect(allowed({ verifiedUserId: null })).toBe(false);
    expect(allowed({ account: null })).toBe(false);
    expect(allowed({ grants: [] })).toBe(false);
    expect(allowed({ account: { ...account, isEnabled: false } })).toBe(false);
    expect(allowed({ account: { ...account, disabledAt: "2026-10-01T00:00:00Z" } })).toBe(false);
    expect(allowed({ verifiedUserId: "other-user" })).toBe(false);
  });
  it("rejects revoked, expired, future, and malformed grants", () => {
    expect(allowed({ grants: [{ ...grant, revokedAt: "2026-10-24T00:00:00Z" }] })).toBe(false);
    expect(allowed({ grants: [{ ...grant, validUntil: "2026-10-25T12:00:00Z" }] })).toBe(false);
    expect(allowed({ grants: [{ ...grant, validFrom: "2026-10-26T00:00:00Z" }] })).toBe(false);
    expect(allowed({ grants: [{ ...grant, validFrom: "bad-date" }] })).toBe(false);
  });
  it("rejects wrong scope, capability, identity, and cross-user grants", () => {
    expect(allowed({ scopeKey: "crm:team-b" })).toBe(false);
    expect(allowed({ scopeKind: "module" })).toBe(false);
    expect(allowed({ capability: "crm.write" })).toBe(false);
    expect(allowed({ grants: [{ ...grant, subjectUserId: "other-user" }] })).toBe(false);
    expect(allowed({ grants: [{ ...grant, scopeKind: "module", scopeKey: "crm" }] })).toBe(false);
  });
  it("blocks self-assignment, while not claiming to approve any write", () => {
    expect(canIssueGrant(user, user)).toBe(false);
    expect(canIssueGrant(null, user)).toBe(false);
    expect(canIssueGrant("independent-actor", user)).toBe(true);
  });
});
