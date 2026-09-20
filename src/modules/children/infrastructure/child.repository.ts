import { prisma, type Tx } from "@/shared/db/prisma";
import type { GuardianRole } from "@/generated/prisma/enums";

export interface NewChild {
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  dateOfBirth: Date;
  primaryLanguage?: string;
  secondaryLanguages?: string[];
  country?: string;
  timezone?: string;
  createdById: string;
}

const guardianInclude = {
  guardians: {
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" as const },
  },
};

export const childRepository = {
  create(data: NewChild, tx?: Tx) {
    return (tx ?? prisma).child.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        preferredName: data.preferredName ?? null,
        dateOfBirth: data.dateOfBirth,
        primaryLanguage: data.primaryLanguage ?? "es",
        secondaryLanguages: data.secondaryLanguages ?? [],
        country: data.country ?? "MX",
        timezone: data.timezone ?? "America/Mexico_City",
        createdById: data.createdById,
      },
    });
  },

  findById(id: string) {
    return prisma.child.findFirst({ where: { id, deletedAt: null }, include: guardianInclude });
  },

  listForGuardian(userId: string) {
    return prisma.child.findMany({
      where: { deletedAt: null, guardians: { some: { userId } } },
      include: guardianInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  update(id: string, data: Partial<Omit<NewChild, "createdById">> & { photoKey?: string | null }) {
    return prisma.child.update({ where: { id }, data });
  },

  softDelete(id: string, tx?: Tx) {
    return (tx ?? prisma).child.update({ where: { id }, data: { deletedAt: new Date() } });
  },

  addGuardian(childId: string, userId: string, role: GuardianRole, relationshipLabel?: string | null, tx?: Tx) {
    return (tx ?? prisma).childGuardian.create({
      data: { childId, userId, role, relationshipLabel: relationshipLabel ?? null },
    });
  },

  removeGuardian(childId: string, userId: string) {
    return prisma.childGuardian.delete({ where: { childId_userId: { childId, userId } } });
  },

  listGuardians(childId: string) {
    return prisma.childGuardian.findMany({
      where: { childId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  },

  countOwners(childId: string) {
    return prisma.childGuardian.count({ where: { childId, role: "OWNER" } });
  },
};
