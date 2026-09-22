import { addDays, subDays } from "date-fns";
import { prisma, type Tx } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import { env } from "@/shared/config/env";
import { generateSecureToken, hashToken } from "@/shared/security/tokens";
import { identityService } from "@/modules/identity/application/identity.service";
import { mailer } from "@/modules/identity/infrastructure/mailer";
import { notificationService } from "@/modules/notifications/application/notification.service";
import type { Actor, UserActor } from "@/modules/identity/domain/types";
import { authorizationService, type ChildAccess } from "@/modules/authorization/application/authorization.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { analyticsService } from "@/modules/analytics/application/analytics.service";
import { userRepository } from "@/modules/identity/infrastructure/user.repository";
import { profileService, type ProfileItemInput } from "@/modules/profiles/application/profile.service";
import { profileRepository } from "@/modules/profiles/infrastructure/profile.repository";
import { careReadiness } from "@/modules/profiles/domain/readiness";
import type { RequestMeta } from "@/shared/security/request-context";
import { childRepository, type NewChild } from "../infrastructure/child.repository";

export interface CreateChildInput extends Omit<NewChild, "createdById"> {
  initialItems?: ProfileItemInput[];
}

export interface InviteGuardianInput {
  email: string;
  role: "OWNER" | "CO_GUARDIAN";
  relationshipLabel?: string;
}

const INVITATION_TTL_DAYS = 7;

/**
 * Retires a child inside a transaction: soft-delete plus revocation of every
 * live grant, link, consent and institution relationship. Shared by the
 * guardian's "delete profile" and by account deletion.
 */
export async function retireChild(tx: Tx, childId: string, reason: string) {
  await childRepository.softDelete(childId, tx);
  await tx.accessGrant.updateMany({
    where: { childId, status: { in: ["ACTIVE", "PENDING"] } },
    data: { status: "REVOKED", revokedAt: new Date(), revokeReason: reason },
  });
  await tx.shareLink.updateMany({ where: { accessGrant: { childId } }, data: { status: "REVOKED" } });
  await tx.consent.updateMany({ where: { childId, status: "ACTIVE" }, data: { status: "REVOKED", revokedAt: new Date() } });
  await tx.childInstitution.updateMany({
    where: { childId, status: { in: ["ACTIVE", "PENDING"] } },
    data: { status: "REVOKED", endedAt: new Date() },
  });
  await tx.guardianInvitation.updateMany({ where: { childId, status: "PENDING" }, data: { status: "REVOKED" } });
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
    await prisma.$transaction((tx) => retireChild(tx, childId, "CHILD_DELETED"));
    await auditService.record({
      type: "CHILD_DELETED",
      actor,
      childId,
      resourceType: "Child",
      resourceId: childId,
      meta,
    });
  },

  // ---------------------------------------------------------------------------
  // Guardian invitations: nobody is attached to a child without accepting.
  // ---------------------------------------------------------------------------

  /**
   * Invites a person (by email) to become a guardian. The invitee accepts from
   * an account whose email matches; the plaintext token only travels in the
   * email link and is returned once here (for the seed and tests).
   */
  async inviteGuardian(actor: UserActor, childId: string, input: InviteGuardianInput, meta?: RequestMeta) {
    await authorizationService.assert(actor, "child.manage_guardians", childId);
    await identityService.assertVerified(actor.userId);
    const email = input.email.trim().toLowerCase();
    if (email === actor.email.toLowerCase()) throw new AppError("VALIDATION_ERROR", "You are already a guardian.");
    const child = await childRepository.findById(childId);
    if (!child) throw new AppError("NOT_FOUND", "Child not found");
    const invitee = await userRepository.findByEmail(email);
    if (invitee && child.guardians.some((g) => g.userId === invitee.id)) {
      throw new AppError("CONFLICT", "That person is already a guardian.");
    }
    await childRepository.revokePendingInvitations(childId, email);
    const token = generateSecureToken();
    const invitation = await childRepository.createInvitation({
      childId,
      invitedById: actor.userId,
      email,
      role: input.role,
      relationshipLabel: input.relationshipLabel,
      tokenHash: hashToken(token),
      expiresAt: addDays(new Date(), INVITATION_TTL_DAYS),
    });
    const childName = child.preferredName ?? child.firstName;
    const url = `${env().APP_URL}/app/invitations/${token}`;
    await mailer().send({
      to: email,
      subject: `${actor.name} te invita como tutor de ${childName} / invites you as guardian`,
      text: `${actor.name} te invitó a ser ${input.role === "OWNER" ? "tutor principal" : "co-tutor"} de ${childName} en Child Care Passport.\n\nAcepta la invitación (válida ${INVITATION_TTL_DAYS} días) con una cuenta registrada con este correo:\n${url}\n\nSi no esperabas esta invitación, ignora este mensaje.`,
    });
    if (invitee) {
      await notificationService.notify({
        userId: invitee.id,
        type: "GUARDIAN_INVITED",
        title: `${actor.name} · ${childName}`,
        data: { invitationId: invitation.id, childName, actorName: actor.name },
      });
    }
    await auditService.record({
      type: "GUARDIAN_INVITED",
      actor,
      childId,
      resourceType: "GuardianInvitation",
      resourceId: invitation.id,
      context: { role: input.role },
      meta,
    });
    return { invitation, token };
  },

  async listInvitations(actor: Actor, childId: string) {
    await authorizationService.assert(actor, "child.manage_guardians", childId);
    return childRepository.listInvitationsForChild(childId);
  },

  async revokeInvitation(actor: Actor, childId: string, invitationId: string, meta?: RequestMeta) {
    await authorizationService.assert(actor, "child.manage_guardians", childId);
    const invitation = await childRepository.findInvitation(invitationId);
    if (!invitation || invitation.childId !== childId) throw new AppError("NOT_FOUND", "Invitation not found");
    if (invitation.status !== "PENDING") throw new AppError("INVALID_STATE", "This invitation is no longer pending.");
    await childRepository.setInvitationStatus(invitationId, "REVOKED");
    await auditService.record({
      type: "GUARDIAN_INVITATION_REVOKED",
      actor,
      childId,
      resourceType: "GuardianInvitation",
      resourceId: invitationId,
      meta,
    });
  },

  /** Invitations addressed to the signed-in user's email (dashboard banner + invitations page). */
  listInvitationsForUser(email: string) {
    return childRepository.listInvitationsForEmail(email);
  },

  /**
   * Resolves the email link. Returns the invitation regardless of the viewer so
   * the page can explain "sign in with <email>"; acceptance still requires the
   * matching account.
   */
  async getInvitationByToken(token: string) {
    const invitation = await childRepository.findInvitationByHash(hashToken(token));
    if (!invitation || invitation.child.deletedAt) throw new AppError("INVALID_TOKEN", "This invitation link is not valid.");
    return invitation;
  },

  async acceptInvitation(actor: UserActor, invitationId: string, meta?: RequestMeta) {
    const invitation = await childRepository.findInvitation(invitationId);
    if (!invitation || invitation.child.deletedAt) throw new AppError("NOT_FOUND", "Invitation not found");
    if (invitation.email !== actor.email.toLowerCase()) {
      throw new AppError("ACCESS_DENIED", "Sign in with the invited email address to accept.");
    }
    if (invitation.status !== "PENDING") throw new AppError("INVALID_STATE", "This invitation is no longer pending.");
    if (invitation.expiresAt < new Date()) {
      await childRepository.setInvitationStatus(invitationId, "EXPIRED");
      throw new AppError("TOKEN_EXPIRED", "This invitation has expired.");
    }
    const guardian = await prisma.$transaction(async (tx) => {
      const existing = await tx.childGuardian.findUnique({
        where: { childId_userId: { childId: invitation.childId, userId: actor.userId } },
      });
      const row =
        existing ??
        (await childRepository.addGuardian(
          invitation.childId,
          actor.userId,
          invitation.role,
          invitation.relationshipLabel,
          tx,
        ));
      await childRepository.setInvitationStatus(
        invitationId,
        "ACCEPTED",
        { acceptedById: actor.userId, acceptedAt: new Date() },
        tx,
      );
      return row;
    });
    await auditService.record({
      type: "GUARDIAN_ADDED",
      actor,
      childId: invitation.childId,
      resourceType: "ChildGuardian",
      resourceId: guardian.id,
      context: { role: invitation.role, invitationId },
      meta,
    });
    await auditService.record({
      type: "GUARDIAN_INVITATION_ACCEPTED",
      actor,
      childId: invitation.childId,
      resourceType: "GuardianInvitation",
      resourceId: invitationId,
      meta,
    });
    const childName = invitation.child.preferredName ?? invitation.child.firstName;
    await notificationService.notify({
      userId: invitation.invitedById,
      type: "GUARDIAN_INVITATION_ACCEPTED",
      title: `${actor.name} · ${childName}`,
      data: { childId: invitation.childId, childName, actorName: actor.name },
    });
    return { guardian, childId: invitation.childId };
  },

  async declineInvitation(actor: UserActor, invitationId: string, meta?: RequestMeta) {
    const invitation = await childRepository.findInvitation(invitationId);
    if (!invitation) throw new AppError("NOT_FOUND", "Invitation not found");
    if (invitation.email !== actor.email.toLowerCase()) throw new AppError("ACCESS_DENIED");
    if (invitation.status !== "PENDING") throw new AppError("INVALID_STATE", "This invitation is no longer pending.");
    await childRepository.setInvitationStatus(invitationId, "DECLINED");
    await auditService.record({
      type: "GUARDIAN_INVITATION_DECLINED",
      actor,
      childId: invitation.childId,
      resourceType: "GuardianInvitation",
      resourceId: invitationId,
      meta,
    });
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
      prisma.changeProposal.groupBy({
        by: ["childId"],
        where: { childId: { in: ids }, status: "PROPOSED" },
        _count: { _all: true },
      }),
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
        readiness: careReadiness(childItems, { now }),
        pendingProposals: proposals.find((p) => p.childId === child.id)?._count._all ?? 0,
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

    return {
      children: summaries,
      expiringGrants,
      pendingProposals: proposals.reduce((n, p) => n + p._count._all, 0),
      pendingInstitutions,
      recentAudit,
    };
  },
};
