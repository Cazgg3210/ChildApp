import type { NextRequest } from "next/server";
import { apiHandler, parseJson } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { profileService } from "@/modules/profiles/application/profile.service";
import { profileItemInputSchema } from "@/modules/children/presentation/schemas";

export const PATCH = apiHandler(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/profile/[itemId]">) => {
    const { actor } = await requireApiUser();
    const { id, itemId } = await ctx.params;
    const input = await parseJson(req, profileItemInputSchema.partial());
    return profileService.updateItem(actor, id, itemId, input, metaFromRequest(req));
  },
);

export const DELETE = apiHandler(
  async (req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/profile/[itemId]">) => {
    const { actor } = await requireApiUser();
    const { id, itemId } = await ctx.params;
    return profileService.removeItem(actor, id, itemId, metaFromRequest(req));
  },
);
