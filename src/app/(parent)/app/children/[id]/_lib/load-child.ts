import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUserActor } from "@/modules/identity/application/session";
import { childrenService } from "@/modules/children/application/children.service";
import { AppError } from "@/shared/errors/app-error";

/**
 * Loads a child for the guardian area. Memoized per request so layout and page
 * share one query. Non-guardians get a 404 (existence is not revealed).
 */
export const loadGuardianChild = cache(async (childId: string) => {
  const { user, actor } = await requireUserActor();
  try {
    const { child, access } = await childrenService.get(actor, childId);
    if (access.via !== "guardian") notFound();
    return { user, actor, child, access };
  } catch (err) {
    if (AppError.is(err) && err.code === "NOT_FOUND") notFound();
    throw err;
  }
});
