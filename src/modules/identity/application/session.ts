import { cache } from "react";
import { AppError } from "@/shared/errors/app-error";
import { auth } from "./auth";
import { identityService } from "./identity.service";
import type { CurrentUser, UserActor } from "../domain/types";
import { userActor } from "../domain/types";

/**
 * Resolves the authenticated user for the current request (memoized per request).
 * Returns null when there is no session or when the session's version is stale
 * (password changed / signed out everywhere).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await identityService.getUserById(id);
  if (!user) return null;
  if (user.sessionVersion !== session.sessionVersion) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    locale: user.locale,
    timezone: user.timezone,
    emailVerifiedAt: user.emailVerifiedAt,
    isDemo: user.isDemo,
  };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("NOT_AUTHENTICATED", "Please sign in.");
  return user;
}

export async function requireUserActor(): Promise<{ user: CurrentUser; actor: UserActor }> {
  const user = await requireUser();
  return { user, actor: userActor(user) };
}
