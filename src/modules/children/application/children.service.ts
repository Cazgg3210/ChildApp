import { subDays } from "date-fns";
import { prisma } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import type { Actor, UserActor } from "@/modules/identity/domain/types";
import { authorizationService, type ChildAccess } from "@/modules/authorization/application/authorization.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { analyticsService } from "@/modules/analytics/application/analytics.service";
import { userRepository } from "@/modules/identity/infrastructure/user.repository";
import { profileService, type ProfileItemInput } from "@/modules/profiles/application/profile.service";
import { profileRepository } from "@/modules/profiles/infrastructure/profile.repository";
import type { RequestMeta } from "@/shared/security/request-context";
import { childRepository, type NewChild } from "../infrastructure/child.repository";

export interface CreateChildInput extends Omit<NewChild, "createdById"> {
  initialItems?: ProfileItemInput[];
}

export const childrenService = {
  async create(actor: UserActor, input: CreateChildInput, meta?: RequestMeta) {
    const child = await prisma.$transaction(async (tx) => {
      const created = await childRepository.create({ ...input, createdById: actor.userId }, tx);
      await childRepository.addGuardian(created.id, actor.userId, "OWNER", null, tx);
      await profileRepository.createVersion(
        { childId: created.id, version: 1, snapshot: [], changes: [], summary: "created", createdById: actor.userId },
        tx,
      );
      return created;
    });
    await auditService.record({
      type: "CHILD_CREATED",
      actor,
      childId: child.id,
      resourceType: "Child",
      resourceId: child.id,
      meta,
    });
    await analyticsService.track("PROFILE_CREATED", { userId: actor.userId, childId: child.id });
    if (input.initialItems?.length) {
      await profileService.addItems(actor, child.id, input.initialItems, meta);
    }
    return child;
  },

  listForGuardian(userId: string) {
    return childRepository.listForGuardian(userId);
  },

  /** Loads a child the actor may read, together with the access path used. */
  async get(
    actor: Actor,
    childId: string,
  ): Promise<{ child: NonNullable<Awaited<ReturnType<typeof childRepository.findById>>>; access: ChildAccess }> {
    const decision = await authorizationService.resolveChildAccess(actor, childId);
    if (!decision.allowed) {
      // Do not reveal whether the child exists to actors without a relationship.
      if (decision.reason === "ACCESS_DENIED" || decision.reason === "NOT_AUTHENTICATED")
        throw new AppError("NOT_FOUND", "Child not found");
      throw new AppError(decision.reason);
    }
    const child = await childRepository.findById(childId);
    if (!child) throw new AppError("NOT_FOUND", "Child not found");
    return { child, access: decision.access };
  },

  async update(actor: Actor, childId: string, data: Partial<Omit<NewChild, "createdById">>, meta?: RequestMeta) {
    await authorizationService.assert(actor, "child.update", childId);
    const child = await childRepository.update(childId, data);
    await auditService.record({
      type: "CHILD_UPDATED",
      actor,
      childId,
      resourceType: "Child",
      resourceId: childId,
      meta,
    });
    return child;
  },

  async remove(actor: Actor, childId: string, meta?: RequestMeta) {
    await authorizationService.assert(actor, "child.delete", childId);
    await prisma.$transaction(async (tx) => {
      await childRepository.softDelete(childId, tx);
      await tx.accessGrant.updateMany({
        where: { childId, status: { in: ["ACTIVE", "PENDING"] } },
        data: { status: "REVOKED", revokedAt: new Date(), revokeReason: "CHILD_DELETED" },
      });
      await tx.shareLink.updateMany({ where: { accessGrant: { childId } }, data: { status: "REVOKED" } });
      await tx.consent.updateMany({
        where: { childId, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: new Date() },
      });
      await tx.childInstitution.updateMany({
        where: { childId, status: { in: ["ACTIVE", "PENDING"] } },
        data: { status: "REVOKED", endedAt: new Date() },
      });
    });
    await auditService.record({
      type: "CHILD_DELETED",
      actor,
      childId,
      resourceType: "Child",
      resourceId: childId,
      meta,
    });
  },

  async addGuardian(
    actor: Actor,
    childId: string,
    email: string,
    role: "OWNER" | "CO_GUARDIAN",
    relationshipLabel?: string,
    meta?: RequestMeta,
  ) {
    await authorizationService.assert(actor, "child.manage_guardians", childId);
    const user = await userRepository.findByEmail(email);
    if (!user) throw new AppError("NOT_FOUND", "No account exists with that email.");
    const existing = await prisma.childGuardian.findUnique({ where: { childId_userId: { childId, userId: user.id } } });
    if (existing) throw new AppError("CONFLICT", "That person is already a guardian.");
    const guardian = await childRepository.addGuardian(childId, user.id, role, relationshipLabel);
    await auditService.record({
      type: "GUARDIAN_ADDED",
      actor,
      childId,
      resourceType: "ChildGuardian",
      resourceId: guardian.id,
      context: { role },
      meta,
    });
    return guardian;
  },

  async removeGuardian(actor: Actor, childId: string, userId: string, meta?: RequestMeta) {
    await authorizationService.assert(actor, "child.manage_guardians", childId);
    const target = await prisma.childGuardian.findUnique({ where: { childId_userId: { childId, userId } } });
    if (!target) throw new AppError("NOT_FOUND", "Guardian not found");
    if (target.role === "OWNER" && (await childRepository.countOwners(childId)) <= 1) {
      throw new AppError("INVALID_STATE", "At least one primary guardian must remain.");
    }
    await childRepository.removeGuardian(childId, userId);
    await auditService.record({
      type: "GUARDIAN_REMOVED",
      actor,
      childId,
      resourceType: "ChildGuardian",
      resourceId: target.id,
      meta,
    });
  },

  /** Aggregates for the guardian dashboard and the children list. */
  async dashboard(userId: string) {
    const children = await childRepository.listForGuardian(userId);
    if (children.length === 0) {
      return { children: [], expiringGrants: [], pendingProposals: 0, pendingInstitutions: [], recentAudit: [] };
    }
    const ids = children.map((c) => c.id);
    const now = new Date();
    const weekAgo = subDays(now, 7);
    const weekAhead = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

    const [grants, institutions, versions, proposals, items, recentAudit] = await Promise.all([
      prisma.accessGrant.findMany({
        where: {
          childId: { in: ids },
          status: "ACTIVE",
          startsAt: { lte: now },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        include: { shareLink: { select: { status: true, maxUses: true, useCount: true } } },
      }),
      prisma.childInstitution.findMany({
        where: { childId: { in: ids }, status: { in: ["ACTIVE", "PENDING"] } },
        include: { institution: { select: { name: true } } },
      }),
      prisma.childProfileVersion.findMany({
        where: { childId: { in: ids }, createdAt: { gte: weekAgo }, version: { gt: 1 } },
        select: { childId: true, changes: true, createdAt: true },
      }),
      prisma.changeProposal.count({ where: { childId: { in: ids }, status: "PROPOSED" } }),
      profileRepository.listActiveForChildren(ids),
      prisma.auditEvent.findMany({ where: { childId: { in: ids } }, orderBy: { createdAt: "desc" }, take: 8 }),
    ]);

    const activeGrants = grants.filter(
      (g) =>
        !g.shareLink ||
        (g.shareLink.status === "ACTIVE" &&
          (g.shareLink.maxUses === null || g.shareLink.useCount < g.shareLink.maxUses)),
    );

    const summaries = children.map((child) => {
      const childGrants = activeGrants.filter((g) => g.childId === child.id);
      const childVersions = versions.filter((v) => v.childId === child.id);
      const childItems = items.filter((i) => i.childId === child.id);
      const criticalChangedAt = childVersions
        .filter((v) => Array.isArray(v.changes) && (v.changes as { critical?: boolean }[]).some((c) => c.critical))
        .map((v) => v.createdAt)
        .sort((a, b) => b.getTime() - a.getTime())[0];
      return {
        child,
        activeCaregivers: childGrants.filter((g) => g.subjectType !== "INSTITUTION").length,
        connectedInstitutions: institutions.filter((i) => i.childId === child.id && i.status === "ACTIVE").length,
        changesThisWeek: childVersions.length,
        criticalChangedAt: criticalChangedAt ?? null,
        criticalCount: childItems.filter((i) => i.criticality === "CRITICAL").length,
        itemCount: childItems.length,
      };
    });

    const expiringGrants = activeGrants
      .filter((g) => g.expiresAt && g.expiresAt <= weekAhead)
      .sort((a, b) => a.expiresAt!.getTime() - b.expiresAt!.getTime())
      .map((g) => ({
        id: g.id,
        childId: g.childId,
        recipientName: g.recipientName,
        recipientKind: g.recipientKind,
        expiresAt: g.expiresAt!,
      }));

    const pendingInstitutions = institutions
      .filter((i) => i.status === "PENDING")
      .map((i) => ({ childId: i.childId, name: i.institution.name }));

    return { children: summaries, expiringGrants, pendingProposals: proposals, pendingInstitutions, recentAudit };
  },
};
