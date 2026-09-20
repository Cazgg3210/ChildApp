import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/http/api";
import { requireApiUser } from "@/shared/http/api-auth";
import { documentService } from "@/modules/documents/application/document.service";

export const GET = apiHandler(async (_req: NextRequest, ctx: RouteContext<"/api/v1/children/[id]/documents">) => {
  const { actor } = await requireApiUser();
  const { id } = await ctx.params;
  const documents = await documentService.list(actor, id);
  return {
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      category: d.category,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      createdAt: d.createdAt,
    })),
  };
});
