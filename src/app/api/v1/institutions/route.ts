import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiHandler, parseJson } from "@/shared/http/api";
import { metaFromRequest, requireApiUser } from "@/shared/http/api-auth";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { InstitutionType } from "@/generated/prisma/enums";

export const GET = apiHandler(async () => {
  const { userId } = await requireApiUser();
  const memberships = await institutionService.listForUser(userId);
  return {
    institutions: memberships.map((m) => ({
      id: m.institution.id,
      name: m.institution.name,
      type: m.institution.type,
      role: m.role,
      inviteCode: m.role === "ADMIN" ? m.institution.inviteCode : undefined,
    })),
  };
});

export const POST = apiHandler(async (req: NextRequest) => {
  const { actor } = await requireApiUser();
  const input = await parseJson(
    req,
    z.object({ name: z.string().trim().min(2).max(120), type: z.enum(InstitutionType).default("OTHER") }),
  );
  const institution = await institutionService.create(actor, input, metaFromRequest(req));
  return NextResponse.json({ institution }, { status: 201 });
});
