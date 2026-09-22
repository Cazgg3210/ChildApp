import { subDays } from "date-fns";
import { prisma } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import { generateInviteCode } from "@/shared/security/tokens";
import type { RequestMeta } from "@/shared/security/request-context";
import type { DataCategory, ProfileSectionValue } from "@/shared/domain/care-vocabulary";
import type { InstitutionType, InstitutionVerificationStatus } from "@/generated/prisma/enums";
import { identityService } from "@/modules/identity/application/identity.service";
import { careReadiness, READINESS_KEY_BY_CATEGORY, type ReadinessKey } from "@/modules/profiles/domain/readiness";
import type { Actor, UserActor } from "@/modules/identity/domain/types";
import { authorizationService, toGrantView } from "@/modules/authorization/application/authorization.service";
import { effectiveGrantStatus, evaluateGrantValidity, visibleCategories } from "@/modules/authorization/domain/policy";
import { auditService } from "@/modules/audit/application/audit.service";
import { analyticsService } from "@/modules/analytics/application/analytics.service";
import { notificationService } from "@/modules/notifications/application/notification.service";
import { userRepository } from "@/modules/identity/infrastructure/user.repository";
import { profileRepository } from "@/modules/profiles/infrastructure/profile.repository";
import { filterItemsByCategories, profileService } from "@/modules/profiles/application/profile.service";
import { categoryOf, isItemTypeOf } from "@/modules/profiles/domain/catalog";
import { sharingRepository } from "@/modules/sharing/infrastructure/sharing.repository";
import { institutionRepository, type InstitutionDetails } from "../infrastructure/institution.repository";

const relationInclude = {
  child: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      preferredName: true,
      dateOfBirth: true,
      profileVersion: true,
      updatedAt: true,
      createdAt: true,
      deletedAt: true,
    },
  },
  accessGrant: { include: { shareLink: true, grantedBy: { select: { id: true, name: true } } } },
  groups: { select: { group: { select: { id: true, name: true } } } },
};

/** Fields an institution must fill before asking for verification. */
const VERIFICATION_REQUIRED: (keyof InstitutionDetails)[] = ["legalName", "contactName", "phone"];

async function guardianIds(childId: string) {
  return (await prisma.childGuardian.findMany({ where: { childId }, select: { userId: true } })).map((g) => g.userId);
}

export const institutionService = {
  async create(actor: UserActor, input: { name: string; type: InstitutionType }, meta?: RequestMeta) {
    const name = input.name.trim();
    if (!name) throw new AppError("VALIDATION_ERROR", "Name is required.");
    await identityService.assertVerified(actor.userId);
    const institution = await prisma.$transaction(async (tx) => {
      let inviteCode = generateInviteCode(name);
      // Extremely unlikely collision; retry once.
      if (await tx.institution.findUnique({ where: { inviteCode } })) inviteCode = generateInviteCode(name);
      const created = await institutionRepository.create(
        { name, type: input.type, inviteCode, createdById: actor.userId },
        tx,
      );
      await institutionRepository.addMember(created.id, actor.userId, "ADMIN", undefined, tx);
      return created;
    });
    await auditService.record({
      type: "INSTITUTION_CREATED",
      actor,
      institutionId: institution.id,
      resourceType: "Institution",
      resourceId: institution.id,
      meta,
    });
    return institution;
  },

  listForUser(userId: string) {
    return institutionRepository.listMembershipsForUser(userId);
  },

  async get(actor: Actor, institutionId: string) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    const institution = await institutionRepository.findById(institutionId);
    if (!institution) throw new AppError("NOT_FOUND", "Institution not found");
    const membership =
      actor.type === "user" ? await institutionRepository.findMembership(institutionId, actor.userId) : null;
    return { institution, role: membership?.role ?? ("ADMIN" as const) };
  },

  async addMember(
    actor: Actor,
    institutionId: string,
    email: string,
    role: "ADMIN" | "MEMBER",
    title?: string,
    meta?: RequestMeta,
  ) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const user = await userRepository.findByEmail(email);
    if (!user) throw new AppError("NOT_FOUND", "No account exists with that email.");
    if (await institutionRepository.findMembership(institutionId, user.id))
      throw new AppError("CONFLICT", "Already a member.");
    const member = await institutionRepository.addMember(institutionId, user.id, role, title);
    await auditService.record({
      type: "INSTITUTION_MEMBER_ADDED",
      actor,
      institutionId,
      resourceType: "InstitutionMember",
      resourceId: member.id,
      context: { role },
      meta,
    });
    return member;
  },

  async removeMember(actor: Actor, institutionId: string, userId: string, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const target = await institutionRepository.findMembership(institutionId, userId);
    if (!target) throw new AppError("NOT_FOUND", "Member not found");
    if (target.role === "ADMIN" && (await institutionRepository.countAdmins(institutionId)) <= 1) {
      throw new AppError("INVALID_STATE", "At least one administrator must remain.");
    }
    await institutionRepository.removeMember(institutionId, userId);
    await auditService.record({
      type: "INSTITUTION_MEMBER_REMOVED",
      actor,
      institutionId,
      resourceType: "InstitutionMember",
      resourceId: target.id,
      meta,
    });
  },

  async listMembers(actor: Actor, institutionId: string) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    return institutionRepository.listMembers(institutionId);
  },

  // ---------------------------------------------------------------------------
  // Details & verification (manual, by the platform team — docs/16-decisions.md)
  // ---------------------------------------------------------------------------

  async updateDetails(actor: Actor, institutionId: string, input: InstitutionDetails, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const clean = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
    const institution = await institutionRepository.updateDetails(institutionId, {
      name: input.name?.trim() || undefined,
      legalName: clean(input.legalName),
      address: clean(input.address),
      phone: clean(input.phone),
      website: clean(input.website),
      contactName: clean(input.contactName),
    });
    await auditService.record({
      type: "INSTITUTION_UPDATED",
      actor,
      institutionId,
      resourceType: "Institution",
      resourceId: institutionId,
      meta,
    });
    return institution;
  },

  async requestVerification(actor: Actor, institutionId: string, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const institution = await institutionRepository.findById(institutionId);
    if (!institution) throw new AppError("NOT_FOUND", "Institution not found");
    if (institution.verificationStatus === "VERIFIED") throw new AppError("INVALID_STATE", "Already verified.");
    if (institution.verificationStatus === "SUSPENDED") throw new AppError("INVALID_STATE", "Suspended.");
    const missing = VERIFICATION_REQUIRED.filter((k) => !institution[k]);
    if (missing.length) throw new AppError("VALIDATION_ERROR", "Complete the institution details first.", { missing });
    const updated = await institutionRepository.setVerification(institutionId, "VERIFICATION_PENDING");
    await auditService.record({
      type: "INSTITUTION_VERIFICATION_REQUESTED",
      actor,
      institutionId,
      resourceType: "Institution",
      resourceId: institutionId,
      meta,
    });
    return updated;
  },

  /** Platform-side decision (admin token). Notifies the institution's administrators. */
  async setVerificationStatus(institutionId: string, status: InstitutionVerificationStatus, meta?: RequestMeta) {
    const institution = await institutionRepository.findById(institutionId);
    if (!institution) throw new AppError("NOT_FOUND", "Institution not found");
    const updated = await institutionRepository.setVerification(institutionId, status);
    await auditService.record({
      type: status === "VERIFIED" ? "INSTITUTION_VERIFIED" : "INSTITUTION_UPDATED",
      actor: { type: "system" },
      institutionId,
      resourceType: "Institution",
      resourceId: institutionId,
      context: { verificationStatus: status },
      meta,
    });
    if (status === "VERIFIED") {
      const admins = (await institutionRepository.listMembers(institutionId)).filter((m) => m.role === "ADMIN");
      await notificationService.notifyMany(
        admins.map((m) => m.userId),
        { type: "INSTITUTION_VERIFIED", title: institution.name, data: { institutionId, institutionName: institution.name } },
      );
    }
    return updated;
  },

  // ---------------------------------------------------------------------------
  // Groups / rooms: MEMBERs only see the children of their rooms
  // ---------------------------------------------------------------------------

  async listGroups(actor: Actor, institutionId: string) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    return institutionRepository.listGroups(institutionId);
  },

  async createGroup(actor: Actor, institutionId: string, name: string, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const clean = name.trim();
    if (clean.length < 2) throw new AppError("VALIDATION_ERROR", "Name is required.");
    const group = await institutionRepository.createGroup(institutionId, clean).catch(() => {
      throw new AppError("CONFLICT", "A room with that name already exists.");
    });
    await auditService.record({
      type: "INSTITUTION_GROUP_CREATED",
      actor,
      institutionId,
      resourceType: "InstitutionGroup",
      resourceId: group.id,
      context: { name: clean },
      meta,
    });
    return group;
  },

  async deleteGroup(actor: Actor, institutionId: string, groupId: string, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const group = await institutionRepository.findGroup(institutionId, groupId);
    if (!group) throw new AppError("NOT_FOUND", "Room not found");
    await institutionRepository.deleteGroup(groupId);
    await auditService.record({
      type: "INSTITUTION_GROUP_DELETED",
      actor,
      institutionId,
      resourceType: "InstitutionGroup",
      resourceId: groupId,
      context: { name: group.name },
      meta,
    });
  },

  async setGroupMember(
    actor: Actor,
    institutionId: string,
    groupId: string,
    memberId: string,
    on: boolean,
    meta?: RequestMeta,
  ) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const [group, member] = await Promise.all([
      institutionRepository.findGroup(institutionId, groupId),
      prisma.institutionMember.findFirst({ where: { id: memberId, institutionId } }),
    ]);
    if (!group || !member) throw new AppError("NOT_FOUND", "Room or member not found");
    await institutionRepository.setGroupMember(groupId, memberId, on);
    await auditService.record({
      type: "INSTITUTION_GROUP_UPDATED",
      actor,
      institutionId,
      resourceType: "InstitutionGroup",
      resourceId: groupId,
      context: { member: memberId, on },
      meta,
    });
  },

  async setGroupChild(
    actor: Actor,
    institutionId: string,
    groupId: string,
    relationId: string,
    on: boolean,
    meta?: RequestMeta,
  ) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const [group, relation] = await Promise.all([
      institutionRepository.findGroup(institutionId, groupId),
      prisma.childInstitution.findFirst({ where: { id: relationId, institutionId } }),
    ]);
    if (!group || !relation) throw new AppError("NOT_FOUND", "Room or child not found");
    await institutionRepository.setGroupChild(groupId, relationId, on);
    await auditService.record({
      type: "INSTITUTION_GROUP_UPDATED",
      actor,
      institutionId,
      childId: relation.childId,
      resourceType: "InstitutionGroup",
      resourceId: groupId,
      context: { relation: relationId, on },
      meta,
    });
  },

  /** Null = sees every child (admin, or no rooms defined); otherwise the member's group ids. */
  async roomScope(actor: Actor, institutionId: string): Promise<Set<string> | null> {
    if (actor.type !== "user") return null;
    const membership = await institutionRepository.memberGroupIds(institutionId, actor.userId);
    if (!membership || membership.role === "ADMIN") return null;
    if ((await institutionRepository.countGroups(institutionId)) === 0) return null;
    return new Set(membership.groupIds);
  },

  // ---------------------------------------------------------------------------
  // Relationship lifecycle (guardian shares → institution accepts/declines)
  // ---------------------------------------------------------------------------

  async listPendingRequests(actor: Actor, institutionId: string) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    return prisma.childInstitution.findMany({
      where: { institutionId, status: "PENDING" },
      include: relationInclude,
      orderBy: { invitedAt: "desc" },
    });
  },

  async acceptRequest(actor: UserActor, institutionId: string, relationId: string, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const relation = await prisma.childInstitution.findFirst({
      where: { id: relationId, institutionId, status: "PENDING" },
      include: relationInclude,
    });
    if (!relation) throw new AppError("NOT_FOUND", "Request not found");
    await prisma.$transaction(async (tx) => {
      await sharingRepository.activateGrant(relation.accessGrantId, tx);
      await tx.childInstitution.update({
        where: { id: relation.id },
        data: { status: "ACTIVE", acceptedAt: new Date(), acceptedById: actor.userId },
      });
    });
    await auditService.record({
      type: "INSTITUTION_CONNECTED",
      actor,
      childId: relation.childId,
      institutionId,
      accessGrantId: relation.accessGrantId,
      resourceType: "ChildInstitution",
      resourceId: relation.id,
      meta,
    });
    await analyticsService.track("INSTITUTION_CONNECTED", {
      userId: actor.userId,
      childId: relation.childId,
      institutionId,
    });
    const institution = await institutionRepository.findById(institutionId);
    await notificationService.notifyMany(await guardianIds(relation.childId), {
      type: "INSTITUTION_CONNECTED",
      title: `${institution?.name ?? ""} · ${relation.child.preferredName ?? relation.child.firstName}`,
      data: {
        childId: relation.childId,
        institutionId,
        institutionName: institution?.name ?? "",
        childName: relation.child.preferredName ?? relation.child.firstName,
      },
    });
    return relation;
  },

  async declineRequest(actor: UserActor, institutionId: string, relationId: string, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.manage", institutionId);
    const relation = await prisma.childInstitution.findFirst({
      where: { id: relationId, institutionId, status: "PENDING" },
      include: relationInclude,
    });
    if (!relation) throw new AppError("NOT_FOUND", "Request not found");
    await sharingRepository.revokeGrant(relation.accessGrantId, actor.userId, "INSTITUTION_DECLINED");
    await auditService.record({
      type: "INSTITUTION_DECLINED",
      actor,
      childId: relation.childId,
      institutionId,
      accessGrantId: relation.accessGrantId,
      resourceType: "ChildInstitution",
      resourceId: relation.id,
      meta,
    });
    return relation;
  },

  // ---------------------------------------------------------------------------
  // Dashboard & children
  // ---------------------------------------------------------------------------

  async listChildren(actor: Actor, institutionId: string, now = new Date()) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    const relations = await prisma.childInstitution.findMany({
      where: { institutionId, status: "ACTIVE" },
      include: relationInclude,
      orderBy: { acceptedAt: "desc" },
    });
    const scope = await this.roomScope(actor, institutionId);
    const live = relations.filter(
      (r) =>
        !r.child.deletedAt &&
        evaluateGrantValidity(toGrantView(r.accessGrant), now).valid &&
        (scope === null || r.groups.some((g) => scope.has(g.group.id))),
    );
    const childIds = live.map((r) => r.childId);
    if (childIds.length === 0) return [];
    const [items, acks, memberIds] = await Promise.all([
      profileRepository.listActiveForChildren(childIds),
      prisma.acknowledgement.findMany({
        where: { accessGrantId: { in: live.map((r) => r.accessGrantId) } },
        orderBy: { acknowledgedAt: "desc" },
      }),
      institutionRepository.listMembers(institutionId).then((m) => m.map((x) => x.userId)),
    ]);
    const weekAgo = subDays(now, 7);
    return live.map((r) => {
      const categories = visibleCategories(r.accessGrant);
      const visible = filterItemsByCategories(
        items.filter((i) => i.childId === r.childId),
        categories,
      );
      const criticalAllergies = visible.filter(
        (i) => i.criticality === "CRITICAL" && categoryOf(i.section, i.itemType) === "ALLERGIES",
      );
      const lastAck =
        acks.find(
          (a) => a.accessGrantId === r.accessGrantId && (a.actorUserId ? memberIds.includes(a.actorUserId) : true),
        ) ?? null;
      const lastUpdated = visible.reduce<Date>((max, i) => (i.updatedAt > max ? i.updatedAt : max), r.child.createdAt);
      // Care Readiness restricted to the safety checks this institution was allowed to see.
      const readinessKeys = categories
        .map((c) => READINESS_KEY_BY_CATEGORY[c])
        .filter((k): k is ReadinessKey => Boolean(k));
      const readiness = careReadiness(visible, { now, only: readinessKeys });
      return {
        relation: r,
        child: r.child,
        grant: r.accessGrant,
        groups: r.groups.map((g) => g.group),
        categories,
        readiness,
        criticalAllergies,
        criticalCount: visible.filter((i) => i.criticality === "CRITICAL").length,
        lastUpdated,
        updatedRecently: lastUpdated >= weekAgo,
        isNew: (r.acceptedAt ?? r.invitedAt) >= weekAgo,
        expiringSoon: Boolean(
          r.accessGrant.expiresAt && r.accessGrant.expiresAt <= new Date(now.getTime() + 30 * 24 * 3600 * 1000),
        ),
        acknowledgedCurrent: Boolean(lastAck && lastAck.profileVersion >= r.child.profileVersion),
        lastAck,
        effectiveStatus: effectiveGrantStatus(toGrantView(r.accessGrant), now),
      };
    });
  },

  async dashboard(actor: Actor, institutionId: string) {
    const [children, pendingRequests, recentAudit, institution] = await Promise.all([
      this.listChildren(actor, institutionId),
      prisma.childInstitution.count({ where: { institutionId, status: "PENDING" } }),
      auditService.listForInstitution(institutionId, 8),
      institutionRepository.findById(institutionId),
    ]);
    return {
      institution: institution!,
      childrenCount: children.length,
      criticalAlerts: children.filter((c) => c.criticalCount > 0).length,
      updatedProfiles: children.filter((c) => c.updatedRecently).length,
      pendingAcks: children.filter((c) => !c.acknowledgedCurrent).length,
      readyProfiles: children.filter((c) => c.readiness.ready).length,
      needsReview: children.filter((c) => c.readiness.needsReview || !c.readiness.ready).length,
      expiringConsents: children.filter((c) => c.expiringSoon).length,
      pendingRequests,
      recentAudit,
      children,
    };
  },

  /** Institution child view: strictly the authorized categories, plus consent metadata. */
  async getChild(actor: Actor, institutionId: string, childId: string, meta?: RequestMeta) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    const access = await authorizationService.assert(actor, "child.read", childId);
    if (access.via !== "institution" || access.institutionId !== institutionId) throw new AppError("ACCESS_DENIED");
    const relation = await prisma.childInstitution.findUnique({
      where: { childId_institutionId: { childId, institutionId } },
      include: relationInclude,
    });
    if (!relation || relation.status !== "ACTIVE") throw new AppError("ACCESS_DENIED");
    const items = filterItemsByCategories(await profileService.listItemsUnchecked(childId), access.categories);
    const [acks, proposals] = await Promise.all([
      prisma.acknowledgement.findMany({
        where: { accessGrantId: relation.accessGrantId },
        orderBy: { acknowledgedAt: "desc" },
        take: 5,
      }),
      prisma.changeProposal.findMany({
        where: { childId, institutionId },
        orderBy: { createdAt: "desc" },
        include: { proposedBy: { select: { name: true } } },
      }),
    ]);
    const critical = access.categories.some((c) =>
      (["EMERGENCY", "ALLERGIES", "MEDICATION"] as DataCategory[]).includes(c),
    );
    await auditService.record({
      type: critical ? "CRITICAL_DATA_VIEWED" : "PROFILE_VIEWED",
      actor,
      childId,
      institutionId,
      accessGrantId: relation.accessGrantId,
      resourceType: "ChildProfile",
      resourceId: childId,
      dataCategories: access.categories,
      meta,
    });
    const lastUpdated = items.reduce<Date>(
      (max, i) => (i.updatedAt > max ? i.updatedAt : max),
      relation.child.createdAt,
    );
    return {
      relation,
      child: relation.child,
      grant: relation.accessGrant,
      items,
      categories: access.categories,
      capabilities: access.capabilities,
      acknowledgements: acks,
      proposals,
      lastUpdated,
    };
  },

  // ---------------------------------------------------------------------------
  // Change proposals
  // ---------------------------------------------------------------------------

  async propose(
    actor: UserActor,
    institutionId: string,
    childId: string,
    input: { section: ProfileSectionValue; itemType: string; label: string; details?: string | null },
    meta?: RequestMeta,
  ) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    const access = await authorizationService.assert(actor, "proposal.create", childId);
    if (access.via !== "institution" || access.institutionId !== institutionId) throw new AppError("ACCESS_DENIED");
    if (!isItemTypeOf(input.section, input.itemType)) throw new AppError("VALIDATION_ERROR", "Unknown item type.");
    const label = input.label.trim();
    if (!label) throw new AppError("VALIDATION_ERROR", "Summary is required.");
    const proposal = await prisma.changeProposal.create({
      data: {
        childId,
        institutionId,
        proposedById: actor.userId,
        section: input.section,
        itemType: input.itemType,
        label,
        details: input.details?.trim() || null,
      },
    });
    await auditService.record({
      type: "CHANGE_PROPOSED",
      actor,
      childId,
      institutionId,
      resourceType: "ChangeProposal",
      resourceId: proposal.id,
      context: { section: input.section },
      meta,
    });
    const institution = await institutionRepository.findById(institutionId);
    const child = await prisma.child.findUnique({
      where: { id: childId },
      select: { firstName: true, preferredName: true },
    });
    await notificationService.notifyMany(await guardianIds(childId), {
      type: "CHANGE_PROPOSED",
      title: `${institution?.name ?? ""} · ${label}`,
      body: label,
      data: {
        childId,
        proposalId: proposal.id,
        institutionName: institution?.name ?? "",
        childName: child?.preferredName ?? child?.firstName ?? "",
      },
    });
    return proposal;
  },

  async listProposalsForInstitution(actor: Actor, institutionId: string) {
    await authorizationService.assertInstitution(actor, "institution.read", institutionId);
    return prisma.changeProposal.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
      include: {
        child: { select: { id: true, firstName: true, preferredName: true } },
        proposedBy: { select: { name: true } },
      },
    });
  },

  async listProposalsForChild(actor: Actor, childId: string) {
    await authorizationService.assert(actor, "proposal.review", childId);
    return prisma.changeProposal.findMany({
      where: { childId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        institution: { select: { id: true, name: true } },
        proposedBy: { select: { name: true } },
        reviewedBy: { select: { name: true } },
      },
    });
  },

  async countPendingProposalsForGuardian(userId: string) {
    return prisma.changeProposal.count({ where: { status: "PROPOSED", child: { guardians: { some: { userId } } } } });
  },

  async review(
    actor: UserActor,
    proposalId: string,
    decision: "ACCEPTED" | "REJECTED",
    note?: string,
    meta?: RequestMeta,
  ) {
    const proposal = await prisma.changeProposal.findUnique({
      where: { id: proposalId },
      include: { institution: { select: { id: true, name: true } } },
    });
    if (!proposal) throw new AppError("NOT_FOUND", "Proposal not found");
    await authorizationService.assert(actor, "proposal.review", proposal.childId);
    if (proposal.status !== "PROPOSED") throw new AppError("INVALID_STATE", "This proposal was already reviewed.");
    let resultingItemId: string | null = null;
    if (decision === "ACCEPTED") {
      const { item } = await profileService.addObservedItem(
        actor,
        proposal.childId,
        {
          section: proposal.section,
          itemType: proposal.itemType,
          label: proposal.label,
          details: proposal.details,
          data: (proposal.data as Record<string, unknown> | null) ?? null,
          sourceType: "INSTITUTION",
          sourceLabel: proposal.institution?.name ?? null,
          sourceInstitutionId: proposal.institutionId,
        },
        meta,
      );
      resultingItemId = item.id;
    }
    const updated = await prisma.changeProposal.update({
      where: { id: proposalId },
      data: {
        status: decision,
        reviewedById: actor.userId,
        reviewedAt: new Date(),
        reviewNote: note?.trim() || null,
        resultingItemId,
      },
    });
    await auditService.record({
      type: "CHANGE_REVIEWED",
      actor,
      childId: proposal.childId,
      institutionId: proposal.institutionId,
      resourceType: "ChangeProposal",
      resourceId: proposalId,
      context: { decision },
      meta,
    });
    await notificationService.notify({
      userId: proposal.proposedById,
      type: "CHANGE_REVIEWED",
      title: `${actor.name} · ${proposal.label}`,
      body: proposal.label,
      data: { childId: proposal.childId, proposalId, actorName: actor.name, decision },
    });
    return updated;
  },
};
