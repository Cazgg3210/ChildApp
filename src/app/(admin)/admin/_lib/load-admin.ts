import { cache } from "react";
import { notFound } from "next/navigation";
import { requireUserActor } from "@/modules/identity/application/session";

/** Actor for admin pages; the layout already gated on the role, this re-checks per request. */
export const loadAdmin = cache(async () => {
  const { user, actor } = await requireUserActor();
  if (!user.isPlatformAdmin) notFound();
  return { user, actor };
});
