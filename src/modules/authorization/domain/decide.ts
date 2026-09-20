import type { Capability, DataCategory } from "@/shared/domain/care-vocabulary";
import { CAPABILITIES, DATA_CATEGORIES } from "@/shared/domain/care-vocabulary";
import { evaluateGrantValidity, grantAllowsCapability, grantAllowsCategory, visibleCategories } from "./policy";
import {
  CAPABILITY_FOR_ACTION,
  GUARDIAN_ONLY_ACTIONS,
  OWNER_ONLY_ACTIONS,
  type ChildAccess,
  type ChildAction,
  type Decision,
  type GrantAccessView,
  type GuardianAccessRole,
} from "./types";

export const ALL_CATEGORIES: DataCategory[] = [...DATA_CATEGORIES];
export const ALL_CAPABILITIES: Capability[] = [...CAPABILITIES];

/** Everything the authorization service knows about an actor's relationship to a child. */
export interface AccessFacts {
  guardianRole: GuardianAccessRole | null;
  /** Grants whose subject is the actor (user grant or link grant). */
  directGrants: GrantAccessView[];
  /** Grants held by institutions the actor is a member of, with the actor's role there. */
  institutionGrants: { institutionId: string; institutionRole: "ADMIN" | "MEMBER"; grant: GrantAccessView }[];
}

export function guardianAccess(role: GuardianAccessRole): ChildAccess {
  return { via: "guardian", role, categories: ALL_CATEGORIES, capabilities: ALL_CAPABILITIES };
}

/**
 * Pure decision function: RBAC (guardian / institution roles) + ABAC (grant
 * attributes, time window, categories, capabilities). No I/O.
 */
export function decide(
  facts: AccessFacts,
  action: ChildAction,
  ctx: { now: Date; category?: DataCategory; capability?: Capability },
): Decision {
  // 1. Guardians: full access, except owner-only actions.
  if (facts.guardianRole) {
    if (OWNER_ONLY_ACTIONS.includes(action) && facts.guardianRole !== "OWNER") {
      return { allowed: false, reason: "ACCESS_DENIED" };
    }
    return { allowed: true, access: guardianAccess(facts.guardianRole) };
  }

  // 2. Guardian-only actions cannot be reached through grants.
  if (GUARDIAN_ONLY_ACTIONS.includes(action)) {
    return { allowed: false, reason: "ACCESS_DENIED" };
  }

  // 3. Grants (direct first, then institutional). Pick the first valid one that satisfies the request.
  let lastReason: Decision & { allowed: false } = { allowed: false, reason: "ACCESS_DENIED" };
  const candidates: ChildAccess[] = [
    ...facts.directGrants.map<ChildAccess>((grant) => ({
      via: "grant",
      grant,
      categories: visibleCategories(grant),
      capabilities: grant.capabilities as Capability[],
    })),
    ...facts.institutionGrants.map<ChildAccess>((ig) => ({
      via: "institution",
      institutionId: ig.institutionId,
      institutionRole: ig.institutionRole,
      grant: ig.grant,
      categories: visibleCategories(ig.grant),
      capabilities: ig.grant.capabilities as Capability[],
    })),
  ];

  for (const access of candidates) {
    if (access.via === "guardian") continue;
    const validity = evaluateGrantValidity(access.grant, ctx.now);
    if (!validity.valid) {
      lastReason = { allowed: false, reason: validity.reason };
      continue;
    }
    if (ctx.category && !grantAllowsCategory(access.grant, ctx.category)) {
      lastReason = { allowed: false, reason: "CATEGORY_NOT_SHARED" };
      continue;
    }
    const needed = ctx.capability ?? CAPABILITY_FOR_ACTION[action];
    if (needed && !grantAllowsCapability(access.grant, needed)) {
      lastReason = { allowed: false, reason: "CAPABILITY_MISSING" };
      continue;
    }
    return { allowed: true, access };
  }
  return lastReason;
}
