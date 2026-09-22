import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/shared/http/api";
import { AppError } from "@/shared/errors/app-error";
import { env } from "@/shared/config/env";
import { getRequestMeta } from "@/shared/security/request-context";
import { institutionService } from "@/modules/institutions/application/institution.service";

const bodySchema = z.object({ status: z.enum(["VERIFIED", "UNVERIFIED", "SUSPENDED"]) });

/**
 * Manual institution verification by the platform team (docs/16-decisions.md).
 * Until an admin console exists, an operator with PLATFORM_ADMIN_TOKEN decides
 * after checking the institution's legal details out of band:
 *   curl -X POST $APP_URL/api/v1/admin/institutions/<id>/verification \
 *        -H "X-Admin-Token: $PLATFORM_ADMIN_TOKEN" -H "Content-Type: application/json" \
 *        -d '{"status":"VERIFIED"}'
 */
export const POST = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/admin/institutions/[id]/verification">) => {
  const expected = env().PLATFORM_ADMIN_TOKEN;
  if (!expected) throw new AppError("FEATURE_DISABLED", "Platform administration is not configured.");
  const provided = req.headers.get("x-admin-token") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("ACCESS_DENIED", "Invalid admin token.");
  const { id } = await ctx.params;
  const { status } = bodySchema.parse(await req.json());
  const institution = await institutionService.setVerificationStatus(id, status, await getRequestMeta());
  return { institution: { id: institution.id, verificationStatus: institution.verificationStatus, verifiedAt: institution.verifiedAt } };
});
