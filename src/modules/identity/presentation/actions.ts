"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { signIn, signOut } from "../application/auth";
import { identityService } from "../application/identity.service";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./schemas";
import { fail, formString, type ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import { isLocale } from "@/shared/i18n/locales";

export async function registerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const input = registerSchema.parse({
      name: formString(form, "name"),
      email: formString(form, "email"),
      password: formString(form, "password"),
      locale: formString(form, "locale") || "es",
    });
    await identityService.register(input);
    await signIn("credentials", { email: input.email, password: input.password, redirect: false });
  } catch (err) {
    return toActionState(err);
  }
  redirect("/app?welcome=1");
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const next = formString(form, "next");
  try {
    const input = loginSchema.parse({ email: formString(form, "email"), password: formString(form, "password") });
    await signIn("credentials", { email: input.email, password: input.password, redirect: false });
  } catch (err) {
    if (err instanceof AuthError) {
      return fail("NOT_AUTHENTICATED", "Email or password is incorrect.");
    }
    return toActionState(err);
  }
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/app");
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/login");
}

export async function forgotPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const input = forgotPasswordSchema.parse({ email: formString(form, "email") });
    await identityService.requestPasswordReset(input.email);
    return { ok: true };
  } catch (err) {
    return toActionState(err);
  }
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const input = resetPasswordSchema.parse({
      token: formString(form, "token"),
      password: formString(form, "password"),
    });
    await identityService.resetPassword(input.token, input.password);
  } catch (err) {
    return toActionState(err);
  }
  redirect("/login?reset=1");
}

export async function setLocaleAction(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  const store = await cookies();
  store.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
