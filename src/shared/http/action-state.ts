import type { ErrorCode } from "@/shared/errors/app-error";

/**
 * Uniform result shape for Server Actions consumed with `useActionState`.
 * This module is imported by client components: keep it free of server-only code.
 */
export type ActionState<T = undefined> =
  { ok: true; data?: T } | { ok: false; code: ErrorCode; message: string; fieldErrors?: Record<string, string> };

export const idle: ActionState<never> = { ok: true };

export function fail(code: ErrorCode, message: string, fieldErrors?: Record<string, string>): ActionState<never> {
  return { ok: false, code, message, fieldErrors };
}

export function formString(form: FormData, key: string): string {
  const v = form.get(key);
  return typeof v === "string" ? v : "";
}

export function formStrings(form: FormData, key: string): string[] {
  return form.getAll(key).filter((v): v is string => typeof v === "string");
}
