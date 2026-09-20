import type { Capability, DataCategory } from "@/shared/domain/care-vocabulary";
import type { ErrorCode } from "@/shared/errors/app-error";

/** Storage-agnostic view of an AccessGrant (+ its optional ShareLink) for policy evaluation. */
export interface GrantView {
  id: string;
  childId: string;
  status: "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED";
  startsAt: Date;
  expiresAt: Date | null;
  dataCategories: string[];
  capabilities: string[];
  link?: {
    status: "ACTIVE" | "REVOKED";
    maxUses: number | null;
    useCount: number;
    hasPin: boolean;
    pinAttempts: number;
  } | null;
}

export type DenialReason = Extract<
  ErrorCode,
  | "NOT_AUTHENTICATED"
  | "ACCESS_DENIED"
  | "ACCESS_EXPIRED"
  | "ACCESS_NOT_STARTED"
  | "ACCESS_REVOKED"
  | "ACCESS_EXHAUSTED"
  | "ACCESS_PENDING"
  | "CATEGORY_NOT_SHARED"
  | "CAPABILITY_MISSING"
  | "PIN_REQUIRED"
  | "PIN_LOCKED"
>;

export type Validity = { valid: true } | { valid: false; reason: DenialReason };

export const MAX_PIN_ATTEMPTS = 5;

/**
 * Is the grant usable right now? Evaluated on every request; the persisted
 * status is never trusted on its own for time-based conditions.
 */
export function evaluateGrantValidity(grant: GrantView, now: Date): Validity {
  if (grant.status === "REVOKED") return { valid: false, reason: "ACCESS_REVOKED" };
  if (grant.status === "PENDING") return { valid: false, reason: "ACCESS_PENDING" };
  if (grant.status === "EXPIRED") return { valid: false, reason: "ACCESS_EXPIRED" };
  if (grant.startsAt.getTime() > now.getTime()) return { valid: false, reason: "ACCESS_NOT_STARTED" };
  if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) return { valid: false, reason: "ACCESS_EXPIRED" };
  if (grant.link) {
    if (grant.link.status === "REVOKED") return { valid: false, reason: "ACCESS_REVOKED" };
    if (grant.link.hasPin && grant.link.pinAttempts >= MAX_PIN_ATTEMPTS) return { valid: false, reason: "PIN_LOCKED" };
    // A single-use link is exhausted once it has been opened maxUses times.
    if (grant.link.maxUses !== null && grant.link.useCount >= grant.link.maxUses) {
      return { valid: false, reason: "ACCESS_EXHAUSTED" };
    }
  }
  return { valid: true };
}

export function grantAllowsCategory(grant: Pick<GrantView, "dataCategories">, category: DataCategory): boolean {
  if (category === "IDENTITY") return true;
  return grant.dataCategories.includes(category);
}

export function grantAllowsCapability(grant: Pick<GrantView, "capabilities">, capability: Capability): boolean {
  return grant.capabilities.includes(capability);
}

/** Categories visible through a grant (IDENTITY is implicit). */
export function visibleCategories(grant: Pick<GrantView, "dataCategories">): DataCategory[] {
  const set = new Set<DataCategory>(["IDENTITY"]);
  for (const c of grant.dataCategories) set.add(c as DataCategory);
  return [...set];
}

/** Effective status for display, combining persisted status with time and usage. */
export function effectiveGrantStatus(
  grant: GrantView,
  now: Date,
): "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED" | "NOT_STARTED" | "EXHAUSTED" {
  const v = evaluateGrantValidity(grant, now);
  if (v.valid) return "ACTIVE";
  switch (v.reason) {
    case "ACCESS_REVOKED":
    case "PIN_LOCKED":
      return "REVOKED";
    case "ACCESS_PENDING":
      return "PENDING";
    case "ACCESS_NOT_STARTED":
      return "NOT_STARTED";
    case "ACCESS_EXHAUSTED":
      return "EXHAUSTED";
    default:
      return "EXPIRED";
  }
}
