import type { NextRequest } from "next/server";
import { apiHandler, parseJson } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { childrenService } from "@/modules/children/application/children.service";
import { childBasicsSchema } from "@/modules/children/presentation/schemas";

export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const { child, access } = await childrenService.get(actor, id);
  return { child, access: { via: access.via, categories: access.categories, capabilities: access.capabilities } };
});

export const PATCH = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, childBasicsSchema.partial());
  const child = await childrenService.update(actor, id, input, metaFromRequest(req));
  return { child };
});

export const DELETE = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  await childrenService.remove(actor, id, metaFromRequest(req));
  return { ok: true };
});
