"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { redirect } from "next/navigation";
import { requireUser, requireUserActor } from "../application/session";
import { identityService } from "../application/identity.service";
import { accountService } from "../application/account.service";
import { signOut } from "../application/auth";
import { getRequestMeta } from "@/shared/security/request-context";
import { formString, type ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";

export async function updateAccountAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const user = await requireUser();
    const input = z
      .object({
        name: z.string().trim().min(2).max(80),
        locale: z.enum(["es", "en"]),
        timezone: z.string().min(3).max(64),
      })
      .parse({
        name: formString(form, "name"),
        locale: formString(form, "locale") || "es",
        timezone: formString(form, "timezone") || "America/Mexico_City",
      });
    await identityService.updateProfile(user.id, input);
    const store = await cookies();
    store.set("locale", input.locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
    revalidatePath("/app", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function requestDeletionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    if (formString(form, "confirm").trim().toUpperCase() !== "ELIMINAR") {
      return { ok: false, code: "VALIDATION_ERROR", message: "Type ELIMINAR to confirm.", fieldErrors: { confirm: "ELIMINAR" } };
    }
    await accountService.requestDeletion(actor, await getRequestMeta());
    await signOut({ redirect: false });
  } catch (err) {
    return toActionState(err);
  }
  redirect("/login?deleted=1");
}

export async function resendVerificationAction(): Promise<void> {
  const user = await requireUser();
  await identityService.sendEmailVerification(user.id);
}
