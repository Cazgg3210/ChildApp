import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/http/api";
import { requireApiUser } from "@/shared/http/api-auth";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { ageFromBirthDate } from "@/shared/utils/dates";

export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/institutions/[id]/children">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const rows = await institutionService.listChildren(actor, id);
  return {
    children: rows.map((r) => ({
      id: r.child.id,
      firstName: r.child.firstName,
      lastName: r.child.lastName,
      preferredName: r.child.preferredName,
      age: ageFromBirthDate(r.child.dateOfBirth),
      categories: r.categories,
      criticalAllergies: r.criticalAllergies.map((a) => a.label),
      lastUpdated: r.lastUpdated,
      consent: { status: r.effectiveStatus, expiresAt: r.grant.expiresAt },
      acknowledged: r.acknowledgedCurrent,
    })),
  };
});
