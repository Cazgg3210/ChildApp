import { prisma, type Tx } from "@/shared/db/prisma";
import type { GuardianInvitationStatus, GuardianRole } from "@/generated/prisma/enums";

const invitationInclude = {
  child: { select: { id: true, firstName: true, lastName: true, preferredName: true, deletedAt: true } },
  invitedBy: { select: { id: true, name: true } },
};

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

  // --- Guardian invitations -------------------------------------------------

  createInvitation(data: {
    childId: string;
    invitedById: string;
    email: string;
    role: GuardianRole;
    relationshipLabel?: string | null;
    tokenHash: string;
    expiresAt: Date;
  }) {
    return prisma.guardianInvitation.create({ data: { ...data, relationshipLabel: data.relationshipLabel ?? null } });
  },

  findInvitationByHash(tokenHash: string) {
    return prisma.guardianInvitation.findUnique({ where: { tokenHash }, include: invitationInclude });
  },

  findInvitation(id: string) {
    return prisma.guardianInvitation.findUnique({ where: { id }, include: invitationInclude });
  },

  listInvitationsForChild(childId: string) {
    return prisma.guardianInvitation.findMany({
      where: { childId, status: "PENDING" },
      include: invitationInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  listInvitationsForEmail(email: string) {
    return prisma.guardianInvitation.findMany({
      where: { email: email.toLowerCase(), status: "PENDING", expiresAt: { gt: new Date() }, child: { deletedAt: null } },
      include: invitationInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  setInvitationStatus(
    id: string,
    status: GuardianInvitationStatus,
    extra: { acceptedById?: string; acceptedAt?: Date } = {},
    tx?: Tx,
  ) {
    return (tx ?? prisma).guardianInvitation.update({ where: { id }, data: { status, ...extra } });
  },

  revokePendingInvitations(childId: string, email: string, tx?: Tx) {
    return (tx ?? prisma).guardianInvitation.updateMany({
      where: { childId, email: email.toLowerCase(), status: "PENDING" },
      data: { status: "REVOKED" },
    });
  },
};
