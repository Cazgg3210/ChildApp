"use server";

import { revalidatePath } from "next/cache";
import { requireUserActor } from "@/modules/identity/application/session";
import { institutionRepository } from "@/modules/institutions/infrastructure/institution.repository";
import { getRequestMeta } from "@/shared/security/request-context";
import type { ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import { careShareInputSchema, type CareShareInput } from "../domain/share-input";
import { sharingService } from "../application/sharing.service";

export interface ShareResult {
  grantId: string;
  recipientName: string;
  isInstitution: boolean;
  url: string | null;
  qrDataUrl: string | null;
  hasPin: boolean;
}

export async function createCareShareAction(
  childId: string,
  payload: CareShareInput,
): Promise<ActionState<ShareResult>> {
  try {
    const { actor } = await requireUserActor();
    const input = careShareInputSchema.parse(payload);
    const created = await sharingService.create(actor, childId, input, await getRequestMeta());
    revalidatePath(`/app/children/${childId}`, "layout");
    return {
      ok: true,
      data: {
        grantId: created.grant.id,
        recipientName: created.grant.recipientName,
        isInstitution: created.grant.subjectType === "INSTITUTION",
        url: created.url,
        qrDataUrl: created.qrDataUrl,
        hasPin: Boolean(created.grant.shareLink?.pinHash),
      },
    };
  } catch (err) {
    return toActionState(err);
  }
}

export async function lookupInstitutionAction(
  code: string,
): Promise<ActionState<{ id: string; name: string; type: string } | null>> {
  try {
    await requireUserActor();
    const found = await institutionRepository.findByInviteCode(code);
    return { ok: true, data: found ? { id: found.id, name: found.name, type: found.type } : null };
  } catch (err) {
    return toActionState(err);
  }
}

export async function revokeShareAction(childId: string, grantId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await sharingService.revoke(actor, grantId, "GUARDIAN_REVOKED", await getRequestMeta());
    revalidatePath(`/app/children/${childId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function rotateShareLinkAction(childId: string, grantId: string): Promise<ActionState<ShareResult>> {
  try {
    const { actor } = await requireUserActor();
    const rotated = await sharingService.rotateLink(actor, grantId, await getRequestMeta());
    revalidatePath(`/app/children/${childId}`, "layout");
    return {
      ok: true,
      data: {
        grantId: rotated.grant.id,
        recipientName: rotated.grant.recipientName,
        isInstitution: false,
        url: rotated.url,
        qrDataUrl: rotated.qrDataUrl,
        hasPin: Boolean(rotated.grant.shareLink?.pinHash),
      },
    };
  } catch (err) {
    return toActionState(err);
  }
}
