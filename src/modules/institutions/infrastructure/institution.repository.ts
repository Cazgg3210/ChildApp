import { prisma, type Tx } from "@/shared/db/prisma";
import type { InstitutionRole, InstitutionType, InstitutionVerificationStatus } from "@/generated/prisma/enums";

export interface InstitutionDetails {
  name?: string;
  legalName?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  contactName?: string | null;
}

export const institutionRepository = {
  listMembershipsForUser(userId: string) {
    return prisma.institutionMember.findMany({
      where: { userId },
      include: { institution: true },
      orderBy: { createdAt: "asc" },
    });
  },

  findMembership(institutionId: string, userId: string) {
    return prisma.institutionMember.findUnique({ where: { institutionId_userId: { institutionId, userId } } });
  },

  findById(id: string) {
    return prisma.institution.findUnique({ where: { id } });
  },

  findByInviteCode(code: string) {
    return prisma.institution.findUnique({ where: { inviteCode: code.trim().toUpperCase() } });
  },

  create(
    data: {
      name: string;
      type: InstitutionType;
      inviteCode: string;
      createdById: string;
      country?: string;
      timezone?: string;
    },
    tx?: Tx,
  ) {
    return (tx ?? prisma).institution.create({ data });
  },

  addMember(institutionId: string, userId: string, role: InstitutionRole, title?: string, tx?: Tx) {
    return (tx ?? prisma).institutionMember.create({ data: { institutionId, userId, role, title } });
  },

  removeMember(institutionId: string, userId: string) {
    return prisma.institutionMember.delete({ where: { institutionId_userId: { institutionId, userId } } });
  },

  listMembers(institutionId: string) {
    return prisma.institutionMember.findMany({
      where: { institutionId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  countAdmins(institutionId: string) {
    return prisma.institutionMember.count({ where: { institutionId, role: "ADMIN" } });
  },

  updateDetails(institutionId: string, data: InstitutionDetails) {
    return prisma.institution.update({ where: { id: institutionId }, data });
  },

  setVerification(institutionId: string, status: InstitutionVerificationStatus) {
    return prisma.institution.update({
      where: { id: institutionId },
      data: { verificationStatus: status, verifiedAt: status === "VERIFIED" ? new Date() : null },
    });
  },

  // --- Groups / rooms -------------------------------------------------------

  listGroups(institutionId: string) {
    return prisma.institutionGroup.findMany({
      where: { institutionId },
      orderBy: { name: "asc" },
      include: {
        members: { select: { memberId: true } },
        children: { select: { childInstitutionId: true } },
      },
    });
  },

  countGroups(institutionId: string) {
    return prisma.institutionGroup.count({ where: { institutionId } });
  },

  findGroup(institutionId: string, groupId: string) {
    return prisma.institutionGroup.findFirst({ where: { id: groupId, institutionId } });
  },

  createGroup(institutionId: string, name: string) {
    return prisma.institutionGroup.create({ data: { institutionId, name } });
  },

  deleteGroup(groupId: string) {
    return prisma.institutionGroup.delete({ where: { id: groupId } });
  },

  async setGroupMember(groupId: string, memberId: string, on: boolean) {
    if (on) {
      await prisma.institutionGroupMember.upsert({
        where: { groupId_memberId: { groupId, memberId } },
        create: { groupId, memberId },
        update: {},
      });
    } else {
      await prisma.institutionGroupMember.deleteMany({ where: { groupId, memberId } });
    }
  },

  async setGroupChild(groupId: string, childInstitutionId: string, on: boolean) {
    if (on) {
      await prisma.institutionGroupChild.upsert({
        where: { groupId_childInstitutionId: { groupId, childInstitutionId } },
        create: { groupId, childInstitutionId },
        update: {},
      });
    } else {
      await prisma.institutionGroupChild.deleteMany({ where: { groupId, childInstitutionId } });
    }
  },

  /** Group ids the member belongs to (used for room scoping). */
  async memberGroupIds(institutionId: string, userId: string) {
    const membership = await prisma.institutionMember.findUnique({
      where: { institutionId_userId: { institutionId, userId } },
      select: { role: true, groups: { select: { groupId: true } } },
    });
    return membership ? { role: membership.role, groupIds: membership.groups.map((g) => g.groupId) } : null;
  },
};
