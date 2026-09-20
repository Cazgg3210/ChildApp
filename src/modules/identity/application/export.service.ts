import { prisma } from "@/shared/db/prisma";
import { auditService } from "@/modules/audit/application/audit.service";
import type { UserActor } from "../domain/types";

/**
 * Data portability: everything a guardian owns, as JSON. Full account deletion
 * and retention jobs are V1 (docs/15-roadmap.md); the export is available now.
 */
export const exportService = {
  async exportGuardianData(actor: UserActor) {
    const [user, children] = await Promise.all([
      prisma.user.findUniqueOrThrow({
        where: { id: actor.userId },
        select: { id: true, email: true, name: true, locale: true, timezone: true, country: true, createdAt: true },
      }),
      prisma.child.findMany({
        where: { deletedAt: null, guardians: { some: { userId: actor.userId } } },
        include: {
          guardians: { include: { user: { select: { name: true, email: true } } } },
          profileItems: { where: { deletedAt: null } },
          profileVersions: { orderBy: { version: "asc" } },
          accessGrants: {
            include: {
              consent: true,
              shareLink: { select: { status: true, useCount: true, maxUses: true, lastUsedAt: true, createdAt: true } },
            },
          },
          careSessions: { include: { events: true } },
          acknowledgements: true,
          changeProposals: true,
          documents: {
            where: { deletedAt: null },
            select: { id: true, title: true, category: true, mimeType: true, sizeBytes: true, createdAt: true },
          },
          auditEvents: { orderBy: { createdAt: "asc" } },
        },
      }),
    ]);
    for (const child of children) {
      await auditService.record({
        type: "DATA_EXPORTED",
        actor,
        childId: child.id,
        resourceType: "Child",
        resourceId: child.id,
      });
    }
    return { exportedAt: new Date().toISOString(), user, children };
  },
};
