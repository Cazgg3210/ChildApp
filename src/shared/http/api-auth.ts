import "server-only";
import type { NextRequest } from "next/server";
import { AppError } from "@/shared/errors/app-error";
import { getCurrentUser } from "@/modules/identity/application/session";
import { userActor, type UserActor } from "@/modules/identity/domain/types";
import type { RequestMeta } from "@/shared/security/request-context";

/**
 * API authentication. MVP: same-origin session cookie. The structure leaves
 * room for bearer tokens (integrations) without touching route handlers.
 */
export async function requireApiUser(): Promise<{ actor: UserActor; userId: string }> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("NOT_AUTHENTICATED", "Authentication required.");
  return { actor: userActor(user), userId: user.id };
}

export function metaFromRequest(req: NextRequest): RequestMeta {
  const forwarded = req.headers.get("x-forwarded-for");
  return {
    ipAddress: (forwarded?.split(",")[0] ?? req.headers.get("x-real-ip") ?? undefined)?.trim(),
    userAgent: req.headers.get("user-agent")?.slice(0, 512) ?? undefined,
  };
}
