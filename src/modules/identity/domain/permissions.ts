/**
 * HUB-04: pure authorization policy. Only trusted server/database rows may be
 * passed here; the browser must never supply accounts or grants as authority.
 */
export const CAPABILITIES = [
  "core.read",
  "users.manage",
  "catalog.read",
  "catalog.write",
  "crm.read",
  "crm.write",
  "social.read",
  "social.write",
  "content.review_editorial",
  "content.review_scientific",
  "content.approve_commercial",
] as const;

export type Capability = (typeof CAPABILITIES)[number];
export type ScopeKind = "module" | "resource";

export interface AdminAccount {
  authUserId: string;
  isEnabled: boolean;
  disabledAt: string | null;
}

export interface PermissionGrant {
  subjectUserId: string;
  capabilityCode: string;
  scopeKind: string;
  scopeKey: string;
  validFrom: string;
  validUntil: string | null;
  revokedAt: string | null;
}

export const AUDIT_EVENT_TYPES = [
  "account_created",
  "account_enabled",
  "account_disabled",
  "grant_created",
  "grant_updated",
  "grant_revoked",
] as const;

export function isAuditEventType(value: string): boolean {
  return (AUDIT_EVENT_TYPES as readonly string[]).includes(value);
}

export function canAccess(input: {
  verifiedUserId: string | null;
  account: AdminAccount | null;
  grants: readonly PermissionGrant[];
  capability: Capability;
  scopeKind: ScopeKind;
  scopeKey: string;
  now: Date;
}): boolean {
  const { verifiedUserId, account, grants, capability, scopeKind, scopeKey, now } = input;
  if (!verifiedUserId || !account || account.authUserId !== verifiedUserId) return false;
  if (!account.isEnabled || account.disabledAt !== null) return false;
  if (!Number.isFinite(now.getTime()) || !scopeKey || !scopeKind) return false;
  const at = now.getTime();
  return grants.some((grant) => {
    if (grant.subjectUserId !== verifiedUserId || grant.capabilityCode !== capability) return false;
    // Strict equality; module-scoped grants never silently widen resource access.
    if (grant.scopeKind !== scopeKind || grant.scopeKey !== scopeKey) return false;
    if (grant.revokedAt !== null) return false;
    const from = Date.parse(grant.validFrom);
    const until = grant.validUntil === null ? Infinity : Date.parse(grant.validUntil);
    return Number.isFinite(from) && !Number.isNaN(until) && from <= at && at < until;
  });
}

export function canIssueGrant(verifiedActorId: string | null, subjectId: string): boolean {
  // This only checks segregation; it does NOT independently authorize writes.
  return Boolean(verifiedActorId && subjectId && verifiedActorId !== subjectId);
}
