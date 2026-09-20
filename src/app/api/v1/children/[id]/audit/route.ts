import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler, parseQuery } from "@/shared/http/api";
import { requireApiUser } from "@/shared/http/api-auth";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { auditService } from "@/modules/audit/application/audit.service";

const query = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(100),
  accessOnly: z.enum(["true", "false"]).default("false"),
});

export const GET = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/audit">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  await authorizationService.assert(actor, "audit.read", id);
  const q = parseQuery(req, query);
  const events = await auditService.listForChild(id, { limit: q.limit, accessOnly: q.accessOnly === "true" });
  return { events };
});
