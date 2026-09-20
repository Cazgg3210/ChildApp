import "server-only";
import { ZodError } from "zod";
import { AppError } from "@/shared/errors/app-error";
import { logger } from "@/shared/logging/logger";
import type { ActionState } from "./action-state";

/** Converts thrown errors into an ActionState; rethrows Next.js control-flow errors (redirect/notFound). */
export function toActionState(err: unknown): ActionState<never> {
  if (isNextControlFlow(err)) throw err;
  if (AppError.is(err)) return { ok: false, code: err.code, message: err.message };
  if (err instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "_";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, code: "VALIDATION_ERROR", message: "Please review the highlighted fields.", fieldErrors };
  }
  logger.error({ err }, "Unhandled action error");
  return { ok: false, code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
}

function isNextControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"));
}
