import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiHandler, parseJson } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { careShareInputSchema } from "@/modules/sharing/domain/share-input";

export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/shares">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const grants = await sharingService.listForChild(actor, id);
  return {
    shares: grants.map((g) => ({
      id: g.id,
      recipientKind: g.recipientKind,
      recipientName: g.recipientName,
      status: g.effectiveStatus,
      dataCategories: g.dataCategories,
      capabilities: g.capabilities,
      startsAt: g.startsAt,
      expiresAt: g.expiresAt,
      hasLink: Boolean(g.shareLink),
      lastAcknowledgedAt: g.lastAcknowledgement?.acknowledgedAt ?? null,
      createdAt: g.createdAt,
    })),
  };
});

/** Creates a Care Share. The plaintext token/URL is returned once and never stored. */
export const POST = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/shares">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, careShareInputSchema);
  const created = await sharingService.create(actor, id, input, metaFromRequest(req));
  return NextResponse.json(
    { share: { id: created.grant.id, status: created.grant.status, url: created.url, qrDataUrl: created.qrDataUrl } },
    { status: 201 },
  );
});
