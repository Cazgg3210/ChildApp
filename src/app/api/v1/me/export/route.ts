import { NextResponse } from "next/server";
import { apiHandler } from "@/shared/http/api";
import { requireApiUser } from "@/shared/http/api-auth";
import { exportService } from "@/modules/identity/application/export.service";

export const GET = apiHandler(async () => {
  const { actor } = await requireApiUser();
  const data = await exportService.exportGuardianData(actor);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="child-care-passport-export-${data.exportedAt.slice(0, 10)}.json"`,
      "Cache-Control": "private, no-store",
    },
  });
});
