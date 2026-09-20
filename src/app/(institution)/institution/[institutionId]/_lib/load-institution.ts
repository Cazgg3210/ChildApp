import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUserActor } from "@/modules/identity/application/session";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { AppError } from "@/shared/errors/app-error";

/** Loads the institution for a member; non-members get a 404. Memoized per request. */
export const loadInstitution = cache(async (institutionId: string) => {
  const { user, actor } = await requireUserActor();
  try {
    const { institution, role } = await institutionService.get(actor, institutionId);
    return { user, actor, institution, role };
  } catch (err) {
    if (AppError.is(err) && (err.code === "NOT_FOUND" || err.code === "ACCESS_DENIED")) notFound();
    throw err;
  }
});
