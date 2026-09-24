"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserActor } from "@/modules/identity/application/session";
import { getRequestMeta } from "@/shared/security/request-context";
import { formString, type ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import type { DemoSeedResult } from "@/modules/demo/application/demo-seed";
import { platformAdminService } from "../application/platform-admin.service";

const bool = (form: FormData, key: string) => ["on", "true", "1"].includes(formString(form, key));

export async function adminSetInstitutionVerificationAction(
  institutionId: string,
  status: "VERIFIED" | "UNVERIFIED" | "SUSPENDED" | "VERIFICATION_PENDING",
): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await platformAdminService.setInstitutionVerification(actor, institutionId, status, await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminSetPlatformRoleAction(userId: string, role: "PLATFORM_ADMIN" | "NONE"): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await platformAdminService.setPlatformRole(actor, userId, role, await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminMarkEmailVerifiedAction(userId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await platformAdminService.markEmailVerified(actor, userId, await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminResendVerificationAction(userId: string): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await platformAdminService.resendVerification(actor, userId);
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

const mailSchema = z.object({
  provider: z.enum(["console", "smtp"]),
  host: z.string().trim().max(200),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  user: z.string().trim().max(200),
  password: z.string().max(500).optional().nullable(),
  from: z.string().trim().max(200),
});

export async function adminSaveMailAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    const input = mailSchema.parse({
      provider: formString(form, "provider") || "console",
      host: formString(form, "host"),
      port: formString(form, "port") || "587",
      secure: bool(form, "secure"),
      user: formString(form, "user"),
      password: formString(form, "password") || null,
      from: formString(form, "from"),
    });
    if (input.provider === "smtp" && !input.host) {
      return { ok: false, code: "VALIDATION_ERROR", message: "SMTP host is required.", fieldErrors: { host: "Required" } };
    }
    await platformAdminService.saveMail(actor, input, await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminSendTestMailAction(to: string): Promise<ActionState<{ provider: string; source: string }>> {
  try {
    const { actor } = await requireUserActor();
    const email = z.string().trim().email().parse(to);
    const result = await platformAdminService.sendTestMail(actor, email);
    return { ok: true, data: result };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminSaveSecurityAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await platformAdminService.saveSecurity(
      actor,
      { requireEmailVerification: bool(form, "requireEmailVerification") },
      await getRequestMeta(),
    );
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminSaveFeaturesAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await platformAdminService.saveFeatures(
      actor,
      {
        aiProfileAssistant: bool(form, "aiProfileAssistant"),
        institutionPortal: bool(form, "institutionPortal"),
        documentVerification: bool(form, "documentVerification"),
      },
      await getRequestMeta(),
    );
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminResetSettingAction(key: "mail" | "security" | "features"): Promise<ActionState> {
  try {
    const { actor } = await requireUserActor();
    await platformAdminService.resetSetting(actor, key, await getRequestMeta());
    revalidatePath("/admin", "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function adminSeedDemoAction(reset: boolean): Promise<ActionState<DemoSeedResult>> {
  try {
    const { actor } = await requireUserActor();
    const meta = await getRequestMeta();
    const result = reset ? await platformAdminService.resetDemo(actor, meta) : await platformAdminService.seedDemo(actor, meta);
    revalidatePath("/admin", "layout");
    return { ok: true, data: result };
  } catch (err) {
    return toActionState(err);
  }
}
