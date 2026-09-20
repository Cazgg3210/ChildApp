"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserActor } from "@/modules/identity/application/session";
import { getRequestMeta } from "@/shared/security/request-context";
import { formString, type ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import { DocumentCategory } from "@/generated/prisma/enums";
import { documentService } from "../application/document.service";

export async function uploadDocumentAction(childId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const file = form.get("file");
    if (!(file instanceof File)) throw new Error("File is required");
    const input = z
      .object({ title: z.string().trim().min(1).max(120), category: z.enum(DocumentCategory) })
      .parse({ title: formString(form, "title"), category: formString(form, "category") || "OTHER" });
    await documentService.upload(actor, childId, { ...input, file }, await getRequestMeta());
    revalidatePath(`/app/children/${childId}/documents`);
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function documentUrlAction(documentId: string): Promise<ActionState<{ url: string }>> {
  try {
    const { actor } = await requireUserActor();
    const url = await documentService.signedUrl(actor, documentId, await getRequestMeta());
    return { ok: true, data: { url } };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteDocumentAction(childId: string, documentId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await documentService.remove(actor, documentId, await getRequestMeta());
    revalidatePath(`/app/children/${childId}/documents`);
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}
