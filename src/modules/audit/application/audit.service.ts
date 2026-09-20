import { prisma, type Tx } from "@/shared/db/prisma";
import { logger } from "@/shared/logging/logger";
import type { Actor } from "@/modules/identity/domain/types";
import { actorLabel } from "@/modules/identity/domain/types";
import type { Prisma } from "@/generated/prisma/client";
import type { RequestMeta } from "@/shared/security/request-context";
import { ACCESS_AUDIT_TYPES, type AuditEventType } from "../domain/types";

export interface AuditInput {
  type: AuditEventType;
  actor: Actor;
  childId?: string | null;
  institutionId?: string | null;
  accessGrantId?: string | null;
  careSessionId?: string | null;
  resourceType?: string;
  resourceId?: string;
  dataCategories?: string[];
  context?: Record<string, unknown>;
  meta?: RequestMeta;
}

/**
 * Single entry point for audit trails. Repositories never write AuditEvent
 * rows themselves; services call `audit.record()` inside or after their
 * transaction. Audit is append-only.
 */
export const auditService = {
  async record(input: AuditInput, tx?: Tx): Promise<void> {
    const client = tx ?? prisma;
    const actorType = input.actor.type === "user" ? "USER" : input.actor.type === "link" ? "LINK" : "SYSTEM";
    const actorUserId = input.actor.type === "user" ? input.actor.userId : null;
    const accessGrantId = input.accessGrantId ?? (input.actor.type === "link" ? input.actor.grantId : null);
    try {
      await client.auditEvent.create({
        data: {
          type: input.type,
          actorType,
          actorUserId,
          actorLabel: actorLabel(input.actor),
          childId: input.childId ?? null,
          institutionId: input.institutionId ?? null,
          accessGrantId,
          careSessionId: input.careSessionId ?? null,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          dataCategories: input.dataCategories ?? [],
          ipAddress: input.meta?.ipAddress,
          userAgent: input.meta?.userAgent,
          context: (input.context ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
      logger.info({ audit: input.type, actor: actorType, childId: input.childId ?? undefined }, "audit");
    } catch (err) {
      // An audit failure must never break the user's action, but it must be loud.
      logger.error({ err, type: input.type }, "Failed to record audit event");
      if (tx) throw err;
    }
  },

  /** Full trail for a child (guardian activity view). */
  listForChild(childId: string, opts: { limit?: number; accessOnly?: boolean } = {}) {
    return prisma.auditEvent.findMany({
      where: {
        childId,
        ...(opts.accessOnly ? { type: { in: ACCESS_AUDIT_TYPES } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: opts.limit ?? 100,
      include: { accessGrant: { select: { recipientKind: true, recipientName: true } } },
    });
  },

  listForInstitution(institutionId: string, limit = 50) {
    return prisma.auditEvent.findMany({
      where: { institutionId },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  },

  countForChildSince(childId: string, since: Date) {
    return prisma.auditEvent.count({ where: { childId, createdAt: { gte: since } } });
  },
};
