"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserActor } from "@/modules/identity/application/session";
import { getRequestMeta } from "@/shared/security/request-context";
import { PROFILE_SECTIONS } from "@/shared/domain/care-vocabulary";
import { formString, type ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import { InstitutionType } from "@/generated/prisma/enums";
import { institutionService } from "../application/institution.service";
import { careService } from "@/modules/care/application/care.service";

export async function createInstitutionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  let id: string;
  try {
    const { actor } = await requireUserActor();
    const input = z
      .object({ name: z.string().trim().min(2).max(120), type: z.enum(InstitutionType) })
      .parse({ name: formString(form, "name"), type: formString(form, "type") || "OTHER" });
    const institution = await institutionService.create(actor, input, await getRequestMeta());
    id = institution.id;
  } catch (err) {
    return toActionState(err);
  }
  redirect(`/institution/${id}`);
}

export async function acceptRequestAction(institutionId: string, relationId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.acceptRequest(actor, institutionId, relationId, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function declineRequestAction(institutionId: string, relationId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.declineRequest(actor, institutionId, relationId, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function institutionAcknowledgeAction(institutionId: string, childId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await careService.acknowledge(actor, childId, {}, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

const proposeSchema = z.object({
  section: z.enum(PROFILE_SECTIONS),
  itemType: z.string().min(1),
  label: z.string().trim().min(3).max(120),
  details: z.string().trim().max(2000).optional().nullable(),
});

export async function proposeChangeAction(
  institutionId: string,
  childId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const input = proposeSchema.parse({
      section: formString(form, "section"),
      itemType: formString(form, "itemType"),
      label: formString(form, "label"),
      details: formString(form, "details") || null,
    });
    await institutionService.propose(actor, institutionId, childId, input, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function reviewProposalAction(
  childId: string,
  proposalId: string,
  decision: "ACCEPTED" | "REJECTED",
  note?: string,
): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.review(actor, proposalId, decision, note, await getRequestMeta());
    revalidatePath(`/app/children/${childId}`, "layout");
    revalidatePath("/app");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function addMemberAction(institutionId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const input = z
      .object({
        email: z.string().trim().toLowerCase().email(),
        role: z.enum(["ADMIN", "MEMBER"]),
        title: z.string().trim().max(60).optional(),
      })
      .parse({
        email: formString(form, "email"),
        role: formString(form, "role") || "MEMBER",
        title: formString(form, "title") || undefined,
      });
    await institutionService.addMember(
      actor,
      institutionId,
      input.email,
      input.role,
      input.title,
      await getRequestMeta(),
    );
    revalidatePath(`/institution/${institutionId}/members`);
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

const detailsSchema = z.object({
  name: z.string().trim().min(2).max(120),
  legalName: z.string().trim().max(160).optional().nullable(),
  contactName: z.string().trim().max(120).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  address: z.string().trim().max(240).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
});

export async function updateInstitutionAction(
  institutionId: string,
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const input = detailsSchema.parse({
      name: formString(form, "name"),
      legalName: formString(form, "legalName") || null,
      contactName: formString(form, "contactName") || null,
      phone: formString(form, "phone") || null,
      address: formString(form, "address") || null,
      website: formString(form, "website") || null,
    });
    await institutionService.updateDetails(actor, institutionId, input, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function requestVerificationAction(institutionId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.requestVerification(actor, institutionId, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function createGroupAction(institutionId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.createGroup(actor, institutionId, formString(form, "name"), await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function deleteGroupAction(institutionId: string, groupId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.deleteGroup(actor, institutionId, groupId, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function setGroupMemberAction(
  institutionId: string,
  groupId: string,
  memberId: string,
  on: boolean,
): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.setGroupMember(actor, institutionId, groupId, memberId, on, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function setGroupChildAction(
  institutionId: string,
  groupId: string,
  relationId: string,
  on: boolean,
): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.setGroupChild(actor, institutionId, groupId, relationId, on, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function removeMemberAction(institutionId: string, userId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await institutionService.removeMember(actor, institutionId, userId, await getRequestMeta());
    revalidatePath(`/institution/${institutionId}/members`);
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}
