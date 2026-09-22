import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Capability, DataCategory } from "@/shared/domain/care-vocabulary";
import type { Actor, LinkActor } from "@/modules/identity/domain/types";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import type { DenialReason } from "@/modules/authorization/domain/policy";
import { profileService, filterItemsByCategories } from "@/modules/profiles/application/profile.service";
import { careService } from "../application/care.service";

export type CarePassContext =
  | { state: "denied"; reason: DenialReason | "INVALID_TOKEN" }
  | { state: "pin_required"; childName: string; remaining: number }
  | {
      state: "ok";
      actor: LinkActor;
      grantId: string;
      linkId: string;
      recipientName: string;
      grantedByName: string;
      expiresAt: Date | null;
      child: { id: string; firstName: string; preferredName: string | null; dateOfBirth: Date; profileVersion: number };
      categories: DataCategory[];
      capabilities: Capability[];
      items: Awaited<ReturnType<typeof profileService.listItemsUnchecked>>;
      seen: boolean;
    };

/**
 * Resolves everything the Care Pass needs for the current request, memoized.
 * Reads the signed PIN / seen cookies issued by the care actions.
 */
export const resolveCarePass = cache(async (token: string, opts: { justOpened?: boolean } = {}): Promise<CarePassContext> => {
  const store = await cookies();
  const probe = await sharingService.resolveToken(token, { allowExhausted: true });
  if (!probe.ok) return { state: "denied", reason: probe.reason };
  const { link, grant, child } = probe;

  // "seen" = this device already consumed an opening (signed cookie), or the
  // /open exchange just redirected here (cookie-less browsers).
  const seen =
    sharingService.isPinCookieValid(link.id, store.get(sharingService.seenCookieName(link.id))?.value) ||
    Boolean(opts.justOpened);
  const resolved = seen ? probe : await sharingService.resolveToken(token);
  if (!resolved.ok) return { state: "denied", reason: resolved.reason };

  if (
    sharingService.requiresPin(link) &&
    !sharingService.isPinCookieValid(link.id, store.get(sharingService.pinCookieName(link.id))?.value)
  ) {
    return {
      state: "pin_required",
      childName: child.preferredName ?? child.firstName,
      remaining: Math.max(0, 5 - link.pinAttempts),
    };
  }

  const actor: LinkActor = {
    type: "link",
    grantId: grant.id,
    linkId: link.id,
    childId: child.id,
    recipientName: grant.recipientName,
  };
  const items = filterItemsByCategories(await profileService.listItemsUnchecked(child.id), resolved.categories);
  return {
    state: "ok",
    actor,
    grantId: grant.id,
    linkId: link.id,
    recipientName: grant.recipientName,
    grantedByName: grant.grantedBy.name,
    expiresAt: grant.expiresAt,
    child: {
      id: child.id,
      firstName: child.firstName,
      preferredName: child.preferredName,
      dateOfBirth: child.dateOfBirth,
      profileVersion: child.profileVersion,
    },
    categories: resolved.categories,
    capabilities: resolved.capabilities,
    items,
    seen,
  };
});

export async function carePassViewerState(ctx: Extract<CarePassContext, { state: "ok" }>) {
  const [lastAck, session] = await Promise.all([
    careService.lastAcknowledgement(ctx.child.id, { grantId: ctx.grantId }),
    careService.activeSessionFor(ctx.child.id, { grantId: ctx.grantId }),
  ]);
  const changes = lastAck
    ? await careService.changesSinceLastReview(ctx.child.id, { grantId: ctx.grantId }, ctx.categories)
    : null;
  return { lastAck, session, changes };
}

export function requireLinkActor(ctx: CarePassContext): Actor {
  if (ctx.state !== "ok") throw new Error("not authorized");
  return ctx.actor;
}
