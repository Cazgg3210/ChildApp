import { prisma } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import type { RequestMeta } from "@/shared/security/request-context";
import { auditService } from "@/modules/audit/application/audit.service";
import { retireChild } from "@/modules/children/application/children.service";
import type { UserActor } from "../domain/types";

/** Days a deleted account stays recoverable before `scripts/purge-deleted-accounts.ts` removes it. */
export const DELETION_GRACE_DAYS = 30;

/**
 * Account lifecycle beyond sign-in. Deletion is a two-step process
 * (docs/12-privacy-by-design.md): the request anonymizes the account and
 * revokes everything immediately; the purge job hard-deletes after the grace
 * period so that a mistaken request can still be reverted by support.
 */
export const accountService = {
  /**
   * Refuses when the user is the only administrator of an institution: the
   * institution would become orphaned and the data it received unreachable.
   */
  async deletionBlockers(userId: string) {
    const adminMemberships = await prisma.institutionMember.findMany({
      where: { userId, role: "ADMIN" },
      include: { institution: { select: { id: true, name: true, _count: { select: { members: { where: { role: "ADMIN" } } } } } } },
    });
    return {
      soleAdminOf: adminMemberships.filter((m) => m.institution._count.members <= 1).map((m) => m.institution),
    };
  },

  async requestDeletion(actor: UserActor, meta?: RequestMeta) {
    const { soleAdminOf } = await this.deletionBlockers(actor.userId);
    if (soleAdminOf.length > 0) {
      throw new AppError("INVALID_STATE", "Transfer institution administration before deleting your account.", {
        soleAdminOf: soleAdminOf.map((i) => i.name),
      });
    }
    const now = new Date();
    const retired: string[] = [];
    await prisma.$transaction(async (tx) => {
      const guardianships = await tx.childGuardian.findMany({
        where: { userId: actor.userId },
        include: { child: { select: { id: true, deletedAt: true, guardians: { select: { userId: true, role: true } } } } },
      });
      for (const g of guardianships) {
        const otherOwners = g.child.guardians.filter((x) => x.userId !== actor.userId && x.role === "OWNER");
        if (otherOwners.length === 0 && !g.child.deletedAt) {
          // Nobody else owns this child: the profile goes with the account.
          await retireChild(tx, g.child.id, "ACCOUNT_DELETED");
          retired.push(g.child.id);
        }
        await tx.childGuardian.delete({ where: { id: g.id } });
      }
      await tx.institutionMember.deleteMany({ where: { userId: actor.userId } });
      await tx.guardianInvitation.updateMany({
        where: { invitedById: actor.userId, status: "PENDING" },
        data: { status: "REVOKED" },
      });
      await tx.accessGrant.updateMany({
        where: { subjectType: "USER", subjectUserId: actor.userId, status: { in: ["ACTIVE", "PENDING"] } },
        data: { status: "REVOKED", revokedAt: now, revokeReason: "ACCOUNT_DELETED" },
      });
      await tx.authToken.deleteMany({ where: { userId: actor.userId } });
      await tx.notification.deleteMany({ where: { userId: actor.userId } });
      await tx.user.update({
        where: { id: actor.userId },
        data: {
          email: `deleted-${actor.userId}@deleted.invalid`,
          name: "Deleted account",
          image: null,
          passwordHash: null,
          deletionRequestedAt: now,
          deletedAt: now,
          sessionVersion: { increment: 1 },
        },
      });
    });
    await auditService.record({
      type: "ACCOUNT_DELETION_REQUESTED",
      actor,
      resourceType: "User",
      resourceId: actor.userId,
      context: { retiredChildren: retired.length, purgeAfterDays: DELETION_GRACE_DAYS },
      meta,
    });
    for (const childId of retired) {
      await auditService.record({ type: "CHILD_DELETED", actor, childId, resourceType: "Child", resourceId: childId, meta });
    }
    return { retiredChildren: retired.length };
  },
};
