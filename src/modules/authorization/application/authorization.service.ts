import { prisma } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import type { Capability, DataCategory } from "@/shared/domain/care-vocabulary";
import type { Actor } from "@/modules/identity/domain/types";
import type { AccessGrant, ShareLink } from "@/generated/prisma/client";
import { decide, type AccessFacts } from "../domain/decide";
import type { ChildAccess, ChildAction, Decision, GrantAccessView, InstitutionAction } from "../domain/types";

export type { ChildAccess, ChildAction, Decision };

export function toGrantView(grant: AccessGrant & { shareLink?: ShareLink | null }): GrantAccessView {
  return {
    id: grant.id,
    childId: grant.childId,
    status: grant.status,
    startsAt: grant.startsAt,
    expiresAt: grant.expiresAt,
    dataCategories: grant.dataCategories,
    capabilities: grant.capabilities,
    recipientKind: grant.recipientKind,
    recipientName: grant.recipientName,
    subjectInstitutionId: grant.subjectInstitutionId,
    grantedById: grant.grantedById,
    link: grant.shareLink
      ? {
          status: grant.shareLink.status,
          maxUses: grant.shareLink.maxUses,
          useCount: grant.shareLink.useCount,
          hasPin: Boolean(grant.shareLink.pinHash),
          pinAttempts: grant.shareLink.pinAttempts,
        }
      : null,
  };
}

async function loadFacts(actor: Actor, childId: string): Promise<AccessFacts> {
  const facts: AccessFacts = { guardianRole: null, directGrants: [], institutionGrants: [] };

  if (actor.type === "system") {
    return { guardianRole: "OWNER", directGrants: [], institutionGrants: [] };
  }

  if (actor.type === "link") {
    if (actor.childId !== childId) return facts;
    const grant = await prisma.accessGrant.findUnique({ where: { id: actor.grantId }, include: { shareLink: true } });
    if (grant && grant.childId === childId) facts.directGrants.push(toGrantView(grant));
    return facts;
  }

  if (actor.type === "user") {
    const [guardian, userGrants, memberships] = await Promise.all([
      prisma.childGuardian.findUnique({ where: { childId_userId: { childId, userId: actor.userId } } }),
      prisma.accessGrant.findMany({
        where: { childId, subjectType: "USER", subjectUserId: actor.userId },
        include: { shareLink: true },
      }),
      prisma.institutionMember.findMany({
        where: { userId: actor.userId },
        select: { institutionId: true, role: true },
      }),
    ]);
    facts.guardianRole = guardian?.role ?? null;
    facts.directGrants = userGrants.map(toGrantView);
    if (memberships.length) {
      const institutionGrants = await prisma.accessGrant.findMany({
        where: {
          childId,
          subjectType: "INSTITUTION",
          subjectInstitutionId: { in: memberships.map((m) => m.institutionId) },
        },
        include: { shareLink: true },
      });
      facts.institutionGrants = institutionGrants.map((g) => ({
        institutionId: g.subjectInstitutionId!,
        institutionRole: memberships.find((m) => m.institutionId === g.subjectInstitutionId)!.role,
        grant: toGrantView(g),
      }));
    }
  }
  return facts;
}

/**
 * Single source of truth for "can actor X perform action Y on resource Z given
 * context C?". Components and route handlers never inspect roles directly.
 */
export const authorizationService = {
  async can(
    actor: Actor,
    action: ChildAction,
    childId: string,
    ctx: { category?: DataCategory; capability?: Capability; now?: Date } = {},
  ): Promise<Decision> {
    if (actor.type === "anonymous") return { allowed: false, reason: "NOT_AUTHENTICATED" };
    const facts = await loadFacts(actor, childId);
    return decide(facts, action, { now: ctx.now ?? new Date(), category: ctx.category, capability: ctx.capability });
  },

  async assert(
    actor: Actor,
    action: ChildAction,
    childId: string,
    ctx: { category?: DataCategory; capability?: Capability; now?: Date } = {},
  ): Promise<ChildAccess> {
    const decision = await this.can(actor, action, childId, ctx);
    if (!decision.allowed) throw new AppError(decision.reason);
    return decision.access;
  },

  /** Resolves how (if at all) an actor reaches a child: used by read views to filter categories. */
  async resolveChildAccess(actor: Actor, childId: string, now = new Date()): Promise<Decision> {
    return this.can(actor, "child.read", childId, { now });
  },

  async canInstitution(actor: Actor, action: InstitutionAction, institutionId: string): Promise<boolean> {
    if (actor.type === "system") return true;
    if (actor.type !== "user") return false;
    const membership = await prisma.institutionMember.findUnique({
      where: { institutionId_userId: { institutionId, userId: actor.userId } },
    });
    if (!membership) return false;
    if (action === "institution.manage") return membership.role === "ADMIN";
    return true;
  },

  async assertInstitution(actor: Actor, action: InstitutionAction, institutionId: string): Promise<void> {
    if (actor.type === "anonymous") throw new AppError("NOT_AUTHENTICATED");
    const ok = await this.canInstitution(actor, action, institutionId);
    if (!ok) throw new AppError("ACCESS_DENIED");
  },
};
