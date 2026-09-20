import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/http/api";
import { AppError } from "@/shared/errors/app-error";
import { metaFromRequest } from "@/shared/http/api-auth";
import { CRITICAL_CATEGORIES } from "@/shared/domain/care-vocabulary";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { profileService, filterItemsByCategories } from "@/modules/profiles/application/profile.service";
import { ageFromBirthDate } from "@/shared/utils/dates";

/**
 * Care Pass as JSON (for native/third-party caregiver apps). PIN-protected
 * links require the `X-Care-Pin` header. Every successful read is audited and
 * counts as an opening.
 */
export const GET = apiHandler(async (req: NextRequest, ctx: RouteContext<"/api/v1/shares/[token]">) => {
  const { token } = await ctx.params;
  const meta = metaFromRequest(req);
  const resolved = await sharingService.resolveToken(token);
  if (!resolved.ok) throw new AppError(resolved.reason);
  if (sharingService.requiresPin(resolved.link)) {
    const pin = req.headers.get("x-care-pin");
    if (!pin) throw new AppError("PIN_REQUIRED");
    const check = await sharingService.verifyPin(token, pin, meta);
    if (!check.ok) throw new AppError(check.reason);
  }
  const actor = {
    type: "link" as const,
    grantId: resolved.grant.id,
    linkId: resolved.link.id,
    childId: resolved.child.id,
    recipientName: resolved.grant.recipientName,
  };
  await sharingService.recordOpen(resolved.link.id, actor, resolved.child.id, resolved.categories, meta);
  const critical = resolved.categories.some((c) => CRITICAL_CATEGORIES.includes(c));
  await auditService.record({
    type: critical ? "CRITICAL_DATA_VIEWED" : "PROFILE_VIEWED",
    actor,
    childId: resolved.child.id,
    resourceType: "ChildProfile",
    resourceId: resolved.child.id,
    dataCategories: resolved.categories,
    meta,
  });
  const items = filterItemsByCategories(
    await profileService.listItemsUnchecked(resolved.child.id),
    resolved.categories,
  );
  return {
    child: {
      firstName: resolved.child.firstName,
      preferredName: resolved.child.preferredName,
      age: ageFromBirthDate(resolved.child.dateOfBirth),
      profileVersion: resolved.child.profileVersion,
    },
    sharedBy: resolved.grant.grantedBy.name,
    expiresAt: resolved.grant.expiresAt,
    categories: resolved.categories,
    capabilities: resolved.capabilities,
    items: items.map((i) => ({
      id: i.id,
      section: i.section,
      itemType: i.itemType,
      label: i.label,
      details: i.details,
      data: i.data,
      criticality: i.criticality,
      provenance: i.provenance,
      updatedAt: i.updatedAt,
    })),
  };
});
