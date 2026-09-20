import { prisma, type Tx } from "@/shared/db/prisma";
import type { RecipientKind } from "@/generated/prisma/enums";
import type { Actor } from "@/modules/identity/domain/types";
import { authorizationService } from "@/modules/authorization/application/authorization.service";

/**
 * Consent Ledger: an append-only legal record of what a guardian authorized,
 * for whom, for what purpose and until when. Technical access lives in
 * AccessGrant; the ledger row is created with it and only ever changes status.
 */
export const consentService = {
  record(
    data: {
      childId: string;
      guardianId: string;
      accessGrantId: string;
      recipientType: RecipientKind;
      recipientLabel: string;
      purpose: string;
      dataCategories: string[];
      startsAt: Date;
      expiresAt: Date | null;
    },
    tx?: Tx,
  ) {
    return (tx ?? prisma).consent.create({ data: { ...data, status: "ACTIVE", version: 1 } });
  },

  async listForChild(actor: Actor, childId: string) {
    await authorizationService.assert(actor, "audit.read", childId);
    return prisma.consent.findMany({
      where: { childId },
      orderBy: { createdAt: "desc" },
      include: { guardian: { select: { name: true } } },
    });
  },

  async listForGuardian(guardianId: string) {
    return prisma.consent.findMany({ where: { guardianId }, orderBy: { createdAt: "desc" } });
  },
};

export function purposeFor(kind: RecipientKind): string {
  switch (kind) {
    case "FAMILY":
      return "Family care";
    case "BABYSITTER":
      return "Temporary care";
    case "INSTITUTION":
      return "Institutional care";
    default:
      return "Care";
  }
}
