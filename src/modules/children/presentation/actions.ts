"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserActor } from "@/modules/identity/application/session";
import { getRequestMeta } from "@/shared/security/request-context";
import { formString, formStrings, type ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import { childrenService } from "../application/children.service";
import { profileService } from "@/modules/profiles/application/profile.service";
import { DECLARATION_TYPES } from "@/modules/profiles/domain/catalog";
import {
  inviteGuardianSchema,
  childBasicsSchema,
  createChildSchema,
  profileItemInputSchema,
  type CreateChildPayload,
} from "./schemas";

export async function createChildAction(payload: CreateChildPayload): Promise<ActionState<{ childId: string }>> {
  let childId: string;
  try {
    const { actor } = await requireUserActor();
    const input = createChildSchema.parse(payload);
    const child = await childrenService.create(actor, input, await getRequestMeta());
    childId = child.id;
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath("/app");
  return { ok: true, data: { childId } };
}

export async function updateChildAction(childId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const input = childBasicsSchema.parse({
      firstName: formString(form, "firstName"),
      lastName: formString(form, "lastName"),
      preferredName: formString(form, "preferredName") || null,
      dateOfBirth: formString(form, "dateOfBirth"),
      primaryLanguage: formString(form, "primaryLanguage") || "es",
      secondaryLanguages: formString(form, "secondaryLanguages")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    });
    await childrenService.update(actor, childId, input, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`);
  return { ok: true };
}

export async function deleteChildAction(childId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await childrenService.remove(actor, childId, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath("/app");
  redirect("/app/children");
}

export async function inviteGuardianAction(childId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const input = inviteGuardianSchema.parse({
      email: formString(form, "email"),
      role: formString(form, "role") || "CO_GUARDIAN",
      relationshipLabel: formString(form, "relationshipLabel") || undefined,
    });
    await childrenService.inviteGuardian(actor, childId, input, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`, "layout");
  return { ok: true };
}

export async function revokeInvitationAction(childId: string, invitationId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await childrenService.revokeInvitation(actor, childId, invitationId, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`, "layout");
  return { ok: true };
}

export async function acceptInvitationAction(invitationId: string): Promise<ActionState<{ childId: string }>> {
  try {
    const { actor } = await requireUserActor();
    const { childId } = await childrenService.acceptInvitation(actor, invitationId, await getRequestMeta());
    revalidatePath("/app", "layout");
    return { ok: true, data: { childId } };
  } catch (err) {
    return toActionState(err);
  }
}

export async function declineInvitationAction(invitationId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await childrenService.declineInvitation(actor, invitationId, await getRequestMeta());
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function declareNoneAction(childId: string, kind: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const declaration = DECLARATION_TYPES.find((d) => d === kind);
    if (!declaration) throw new Error("Unknown declaration");
    await profileService.declareNone(actor, childId, declaration, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`, "layout");
  revalidatePath("/app");
  return { ok: true };
}

export async function reconfirmItemAction(childId: string, itemId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await profileService.reconfirmItem(actor, childId, itemId, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`, "layout");
  revalidatePath("/app");
  return { ok: true };
}

export async function removeGuardianAction(childId: string, userId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await childrenService.removeGuardian(actor, childId, userId, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`);
  return { ok: true };
}

function parseItemForm(form: FormData) {
  const dataKeys = formStrings(form, "dataKey");
  const data: Record<string, unknown> = {};
  for (const key of dataKeys) {
    const value = formString(form, `data.${key}`);
    if (value) data[key] = value;
  }
  return profileItemInputSchema.parse({
    section: formString(form, "section"),
    itemType: formString(form, "itemType"),
    label: formString(form, "label"),
    details: formString(form, "details") || null,
    data: Object.keys(data).length ? data : null,
    criticality: formString(form, "criticality") || undefined,
    provenance: formString(form, "provenance") || undefined,
    sourceType: formString(form, "sourceType") || undefined,
    sourceLabel: formString(form, "sourceLabel") || null,
  });
}

export async function saveProfileItemAction(
  childId: string,
  itemId: string | null,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const input = parseItemForm(form);
    const meta = await getRequestMeta();
    if (itemId) await profileService.updateItem(actor, childId, itemId, input, meta);
    else await profileService.addItem(actor, childId, input, meta);
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`, "layout");
  return { ok: true };
}

export async function removeProfileItemAction(childId: string, itemId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await profileService.removeItem(actor, childId, itemId, await getRequestMeta());
  } catch (err) {
    return toActionState(err);
  }
  revalidatePath(`/app/children/${childId}`, "layout");
  return { ok: true };
}

export async function addProfileItemsAction(
  childId: string,
  items: unknown[],
): Promise<ActionState<{ count: number }>> {
  try {
    const { actor } = await requireUserActor();
    const inputs = items.map((i) => profileItemInputSchema.parse(i));
    await profileService.addItems(actor, childId, inputs, await getRequestMeta());
    revalidatePath(`/app/children/${childId}`, "layout");
    return { ok: true, data: { count: inputs.length } };
  } catch (err) {
    return toActionState(err);
  }
}
