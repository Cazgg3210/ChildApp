import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { sharingService } from "@/modules/sharing/application/sharing.service";

export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/grants/[grantId]">) => {
  const { actor } = await requireApiUser();
  const { grantId } = await ctx.params;
  const grant = await sharingService.getForGuardian(actor, grantId);
  return {
    grant: {
      ...grant,
      shareLink: grant.shareLink
        ? {
            status: grant.shareLink.status,
            useCount: grant.shareLink.useCount,
            maxUses: grant.shareLink.maxUses,
            hasPin: Boolean(grant.shareLink.pinHash),
          }
        : null,
    },
  };
});

/** Revocation is immediate: the link stops resolving on the next request. */
export const DELETE = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/grants/[grantId]">) => {
  const { actor } = await requireApiUser();
  const { grantId } = await ctx.params;
  const grant = await sharingService.revoke(actor, grantId, "GUARDIAN_REVOKED", metaFromRequest(req));
  return { grant: { id: grant.id, status: grant.status, revokedAt: grant.revokedAt } };
});
