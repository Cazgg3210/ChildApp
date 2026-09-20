import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiHandler, parseJson } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { childrenService } from "@/modules/children/application/children.service";
import { profileService, filterItemsByCategories, completeness } from "@/modules/profiles/application/profile.service";
import { profileItemInputSchema } from "@/modules/children/presentation/schemas";

/** Returns only the categories the caller is allowed to see (guardian: all). */
export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/profile">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const { child, access } = await childrenService.get(actor, id);
  const items = filterItemsByCategories(await profileService.listItems(actor, id), access.categories);
  return {
    childId: child.id,
    version: child.profileVersion,
    categories: access.categories,
    completeness: completeness(items),
    items,
  };
});

export const POST = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/profile">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const input = await parseJson(req, profileItemInputSchema);
  const result = await profileService.addItem(actor, id, input, metaFromRequest(req));
  return NextResponse.json(result, { status: 201 });
});
