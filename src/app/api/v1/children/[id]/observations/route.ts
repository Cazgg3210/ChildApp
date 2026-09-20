import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, parseJson } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { institutionService } from "@/modules/institutions/application/institution.service";

/** Observations proposed by institutions (ChangeProposal) for a child. */
export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/observations">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const proposals = await institutionService.listProposalsForChild(actor, id);
  return { proposals };
});

const reviewSchema = z.object({
  proposalId: z.string().min(1),
  decision: z.enum(["ACCEPTED", "REJECTED"]),
  note: z.string().max(500).optional(),
});

/** Guardian review of a proposal. */
export const POST = apiHandler(async (req: NextRequest) => {
  const { actor } = await requireApiUser();
  const input = await parseJson(req, reviewSchema);
  const proposal = await institutionService.review(
    actor,
    input.proposalId,
    input.decision,
    input.note,
    metaFromRequest(req),
  );
  return { proposal };
});
