"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@/shared/errors/app-error";
import { env } from "@/shared/config/env";
import { getRequestMeta } from "@/shared/security/request-context";
import { fail, type ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { CareEventType } from "@/generated/prisma/enums";
import { careService } from "../application/care.service";
import { resolveCarePass } from "./care-pass-context";

const cookieOpts = { httpOnly: true, sameSite: "lax" as const, path: "/", secure: env().NODE_ENV === "production" };

async function okContext(token: string) {
  const ctx = await resolveCarePass(token);
  if (ctx.state === "pin_required") throw new AppError("PIN_REQUIRED");
  if (ctx.state === "denied") throw new AppError(ctx.reason === "INVALID_TOKEN" ? "INVALID_TOKEN" : ctx.reason);
  return ctx;
}

export async function verifyPinAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const pin = z
      .string()
      .regex(/^\d{4,6}$/)
      .parse(String(form.get("pin") ?? ""));
    const result = await sharingService.verifyPin(token, pin, await getRequestMeta());
    if (!result.ok) {
      return fail(result.reason, result.reason === "PIN_LOCKED" ? "locked" : String(result.remaining));
    }
    const probe = await sharingService.resolveToken(token, { allowExhausted: true });
    if (probe.ok) {
      const store = await cookies();
      store.set(sharingService.pinCookieName(probe.link.id), result.cookieValue, {
        ...cookieOpts,
        maxAge: result.maxAge,
      });
    }
    revalidatePath(`/s/${token}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function acknowledgeAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await okContext(token);
    const name = z
      .string()
      .trim()
      .min(2)
      .max(80)
      .parse(String(form.get("name") ?? ""));
    const session = await careService.activeSessionFor(ctx.child.id, { grantId: ctx.grantId });
    await careService.acknowledge(
      ctx.actor,
      ctx.child.id,
      { actorName: name, careSessionId: session?.id ?? null },
      await getRequestMeta(),
    );
    revalidatePath(`/s/${token}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function startSessionAction(token: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const ctx = await okContext(token);
    const name = z
      .string()
      .trim()
      .min(2)
      .max(80)
      .parse(String(form.get("name") ?? ""));
    const expected = String(form.get("expectedEndAt") ?? "");
    await careService.startSession(
      ctx.actor,
      ctx.child.id,
      { caregiverName: name, expectedEndAt: expected ? new Date(expected) : null },
      await getRequestMeta(),
    );
    revalidatePath(`/s/${token}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

const eventSchema = z.object({
  sessionId: z.string().min(1),
  type: z.enum(CareEventType),
  note: z.string().trim().max(1000).optional().nullable(),
});

export async function recordCareEventAction(token: string, input: z.infer<typeof eventSchema>): Promise<ActionState> {
  try {
    const ctx = await okContext(token);
    const parsed = eventSchema.parse(input);
    if (parsed.type === "INCIDENT" && !parsed.note) throw new AppError("VALIDATION_ERROR", "Describe the incident.");
    await careService.recordEvent(
      ctx.actor,
      parsed.sessionId,
      { type: parsed.type, note: parsed.note ?? null },
      await getRequestMeta(),
    );
    revalidatePath(`/s/${token}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function endSessionAction(token: string, sessionId: string): Promise<ActionState> {
  try {
    const ctx = await okContext(token);
    await careService.endSession(ctx.actor, sessionId, await getRequestMeta());
    revalidatePath(`/s/${token}`, "layout");
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}
