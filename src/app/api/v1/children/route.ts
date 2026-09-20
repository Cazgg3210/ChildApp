import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { apiHandler, parseJson } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { childrenService } from "@/modules/children/application/children.service";
import { createChildSchema } from "@/modules/children/presentation/schemas";

export const GET = apiHandler(async () => {
  const { userId } = await requireApiUser();
  const children = await childrenService.listForGuardian(userId);
  return { children };
});

export const POST = apiHandler(async (req: NextRequest) => {
  const { actor } = await requireApiUser();
  const input = await parseJson(req, createChildSchema);
  const child = await childrenService.create(actor, input, metaFromRequest(req));
  return NextResponse.json({ child }, { status: 201 });
});
