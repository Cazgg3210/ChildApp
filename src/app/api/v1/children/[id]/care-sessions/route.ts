import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/http/api";
import { requireApiUser } from "@/shared/http/api-auth";
import { careService } from "@/modules/care/application/care.service";

export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/care-sessions">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const sessions = await careService.listSessionsForChild(actor, id);
  return { sessions };
});
