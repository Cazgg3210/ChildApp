import { prisma, type Tx } from "@/shared/db/prisma";
import type { InstitutionRole, InstitutionType } from "@/generated/prisma/enums";

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
};
