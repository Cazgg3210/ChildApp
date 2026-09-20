import { prisma, type Tx } from "@/shared/db/prisma";
import type { GrantSubjectType, RecipientKind } from "@/generated/prisma/enums";

export interface NewGrant {
  childId: string;
  grantedById: string;
  subjectType: GrantSubjectType;
  subjectUserId?: string | null;
  subjectInstitutionId?: string | null;
  recipientKind: RecipientKind;
  recipientName: string;
  recipientEmail?: string | null;
  dataCategories: string[];
  capabilities: string[];
  startsAt: Date;
  expiresAt: Date | null;
  status: "PENDING" | "ACTIVE";
  note?: string | null;
}

const grantInclude = {
  shareLink: true,
  consent: true,
  subjectInstitution: { select: { id: true, name: true, type: true } },
  grantedBy: { select: { id: true, name: true } },
  childInstitution: { select: { status: true } },
};

export const sharingRepository = {
  createGrant(data: NewGrant, tx?: Tx) {
    return (tx ?? prisma).accessGrant.create({ data, include: grantInclude });
  },

  createShareLink(
    data: { accessGrantId: string; tokenHash: string; pinHash?: string | null; maxUses?: number | null },
    tx?: Tx,
  ) {
    return (tx ?? prisma).shareLink.create({ data });
  },

  findGrant(id: string) {
    return prisma.accessGrant.findUnique({ where: { id }, include: grantInclude });
  },

  findGrantByTokenHash(tokenHash: string) {
    return prisma.shareLink.findUnique({
      where: { tokenHash },
      include: {
        accessGrant: {
          include: {
            ...grantInclude,
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                preferredName: true,
                dateOfBirth: true,
                profileVersion: true,
                deletedAt: true,
              },
            },
          },
        },
      },
    });
  },

  listGrantsForChild(childId: string) {
    return prisma.accessGrant.findMany({ where: { childId }, include: grantInclude, orderBy: { createdAt: "desc" } });
  },

  async revokeGrant(id: string, revokedById: string | null, reason: string, tx?: Tx) {
    const client = tx ?? prisma;
    const now = new Date();
    await client.accessGrant.update({
      where: { id },
      data: { status: "REVOKED", revokedAt: now, revokedById, revokeReason: reason },
    });
    await client.shareLink.updateMany({ where: { accessGrantId: id }, data: { status: "REVOKED" } });
    await client.consent.updateMany({
      where: { accessGrantId: id, status: "ACTIVE" },
      data: { status: "REVOKED", revokedAt: now },
    });
    await client.childInstitution.updateMany({
      where: { accessGrantId: id, status: { in: ["ACTIVE", "PENDING"] } },
      data: { status: "REVOKED", endedAt: now },
    });
  },

  activateGrant(id: string, tx?: Tx) {
    return (tx ?? prisma).accessGrant.update({ where: { id }, data: { status: "ACTIVE" } });
  },

  recordLinkUse(linkId: string) {
    return prisma.shareLink.update({
      where: { id: linkId },
      data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
    });
  },

  incrementPinAttempts(linkId: string) {
    return prisma.shareLink.update({ where: { id: linkId }, data: { pinAttempts: { increment: 1 } } });
  },

  resetPinAttempts(linkId: string) {
    return prisma.shareLink.update({ where: { id: linkId }, data: { pinAttempts: 0 } });
  },

  /** Marks time-expired grants as EXPIRED (idempotent housekeeping; validity is also evaluated on read). */
  async expireDueGrants(now = new Date()) {
    const due = await prisma.accessGrant.findMany({
      where: { status: "ACTIVE", expiresAt: { lte: now } },
      select: { id: true },
    });
    if (!due.length) return [];
    const ids = due.map((g) => g.id);
    await prisma.$transaction([
      prisma.accessGrant.updateMany({ where: { id: { in: ids } }, data: { status: "EXPIRED" } }),
      prisma.consent.updateMany({
        where: { accessGrantId: { in: ids }, status: "ACTIVE" },
        data: { status: "EXPIRED" },
      }),
      prisma.childInstitution.updateMany({
        where: { accessGrantId: { in: ids }, status: "ACTIVE" },
        data: { status: "ENDED", endedAt: now },
      }),
    ]);
    return ids;
  },

  lastAcknowledgementForGrant(grantId: string) {
    return prisma.acknowledgement.findFirst({ where: { accessGrantId: grantId }, orderBy: { acknowledgedAt: "desc" } });
  },

  lastAcknowledgementsForGrants(grantIds: string[]) {
    return prisma.acknowledgement.findMany({
      where: { accessGrantId: { in: grantIds } },
      orderBy: { acknowledgedAt: "desc" },
      distinct: ["accessGrantId"],
    });
  },
};

export type GrantWithRelations = NonNullable<Awaited<ReturnType<typeof sharingRepository.findGrant>>>;
