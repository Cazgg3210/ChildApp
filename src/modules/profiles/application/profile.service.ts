import { prisma, type Tx } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import type { DataCategory, ProfileSectionValue } from "@/shared/domain/care-vocabulary";
import { PROFILE_SECTIONS } from "@/shared/domain/care-vocabulary";
import type { ProfileItem } from "@/generated/prisma/client";
import type { Actor } from "@/modules/identity/domain/types";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { notificationService } from "@/modules/notifications/application/notification.service";
import { analyticsService } from "@/modules/analytics/application/analytics.service";
import type { RequestMeta } from "@/shared/security/request-context";
import { categoryOf, defaultCriticality, isItemTypeOf } from "../domain/catalog";
import {
  collapseChanges,
  computeChanges,
  filterChangesForViewer,
  hasCriticalChange,
  summarizeChanges,
  type ProfileChange,
  type SnapshotItem,
} from "../domain/versioning";
import { profileRepository, type NewProfileItem } from "../infrastructure/profile.repository";

export type { ProfileItem };

export function toSnapshot(items: ProfileItem[]): SnapshotItem[] {
  return items.map((i) => ({
    id: i.id,
    section: i.section,
    itemType: i.itemType,
    label: i.label,
    details: i.details,
    data: i.data ?? null,
    criticality: i.criticality,
    provenance: i.provenance,
    sourceType: i.sourceType,
    sourceLabel: i.sourceLabel,
    updatedAt: i.updatedAt.toISOString(),
  }));
}

export interface ProfileItemInput {
  section: ProfileSectionValue;
  itemType: string;
  label: string;
  details?: string | null;
  data?: Record<string, unknown> | null;
  criticality?: "CRITICAL" | "IMPORTANT" | "INFORMATIONAL";
  provenance?: "SELF_DECLARED" | "OBSERVED" | "DOCUMENTED" | "VERIFIED";
  sourceType?: "GUARDIAN" | "FAMILY" | "CAREGIVER" | "INSTITUTION" | "PROFESSIONAL" | "DOCUMENT";
  sourceLabel?: string | null;
  sourceInstitutionId?: string | null;
}

function validateInput(input: ProfileItemInput): NewProfileItem {
  if (!PROFILE_SECTIONS.includes(input.section)) throw new AppError("VALIDATION_ERROR", "Unknown section.");
  if (!isItemTypeOf(input.section, input.itemType))
    throw new AppError("VALIDATION_ERROR", "Unknown item type for section.");
  const label = input.label.trim();
  if (!label) throw new AppError("VALIDATION_ERROR", "Label is required.");
  return {
    section: input.section,
    itemType: input.itemType,
    label,
    details: input.details?.trim() || null,
    data: input.data ?? null,
    criticality: input.criticality ?? defaultCriticality(input.itemType),
    provenance: input.provenance,
    sourceType: input.sourceType,
    sourceLabel: input.sourceLabel?.trim() || null,
    sourceInstitutionId: input.sourceInstitutionId ?? null,
  };
}

/**
 * Every mutation goes through `applyVersionedChange`: read → mutate → diff →
 * bump Child.profileVersion → persist ChildProfileVersion → audit → notify.
 * This is what makes "What's changed since you last reviewed?" possible.
 */
async function applyVersionedChange(
  childId: string,
  actor: Actor,
  mutate: (tx: Tx) => Promise<void>,
  opts: { meta?: RequestMeta; sourceInstitutionId?: string | null } = {},
): Promise<{ version: number; changes: ProfileChange[] }> {
  const actorUserId = actor.type === "user" ? actor.userId : null;
  const result = await prisma.$transaction(async (tx) => {
    const before = toSnapshot(await profileRepository.listActive(childId, tx));
    await mutate(tx);
    const after = toSnapshot(await profileRepository.listActive(childId, tx));
    const changes = computeChanges(before, after);
    if (changes.length === 0) {
      const child = await tx.child.findUniqueOrThrow({ where: { id: childId }, select: { profileVersion: true } });
      return { version: child.profileVersion, changes };
    }
    const child = await tx.child.update({
      where: { id: childId },
      data: { profileVersion: { increment: 1 } },
      select: { profileVersion: true },
    });
    await profileRepository.createVersion(
      {
        childId,
        version: child.profileVersion,
        snapshot: after,
        changes,
        summary: summarizeChanges(changes),
        createdById: actorUserId,
      },
      tx,
    );
    return { version: child.profileVersion, changes };
  });

  if (result.changes.length > 0) {
    const critical = hasCriticalChange(result.changes);
    const categories = [...new Set(result.changes.map((c) => c.category))];
    await auditService.record({
      type: critical ? "CRITICAL_DATA_CHANGED" : "PROFILE_UPDATED",
      actor,
      childId,
      institutionId: opts.sourceInstitutionId ?? undefined,
      resourceType: "ChildProfile",
      resourceId: childId,
      dataCategories: categories,
      context: { version: result.version, changes: result.changes.length },
      meta: opts.meta,
    });
    await analyticsService.track(critical ? "CRITICAL_CHANGE" : "PROFILE_UPDATED", { userId: actorUserId, childId });
    await notifyOtherGuardians(childId, actorUserId, critical, categories);
  }
  return result;
}

async function notifyOtherGuardians(
  childId: string,
  actorUserId: string | null,
  critical: boolean,
  categories: DataCategory[],
) {
  const [guardians, child] = await Promise.all([
    prisma.childGuardian.findMany({ where: { childId }, select: { userId: true } }),
    prisma.child.findUnique({ where: { id: childId }, select: { firstName: true, preferredName: true } }),
  ]);
  const others = guardians.map((g) => g.userId).filter((id) => id !== actorUserId);
  if (!others.length || !child) return;
  await notificationService.notifyMany(others, {
    type: critical ? "CRITICAL_DATA_CHANGED" : "PROFILE_CHANGED",
    title: child.preferredName ?? child.firstName,
    data: { childId, categories, childName: child.preferredName ?? child.firstName },
  });
}

export const profileService = {
  async listItems(actor: Actor, childId: string): Promise<ProfileItem[]> {
    await authorizationService.assert(actor, "profile.read", childId);
    return profileRepository.listActive(childId);
  },

  /** Unauthorized listing for internal composition (callers must have authorized already). */
  listItemsUnchecked(childId: string): Promise<ProfileItem[]> {
    return profileRepository.listActive(childId);
  },

  async addItem(actor: Actor, childId: string, input: ProfileItemInput, meta?: RequestMeta) {
    await authorizationService.assert(actor, "profile.update", childId);
    const data = validateInput(input);
    let created: ProfileItem | undefined;
    const result = await applyVersionedChange(
      childId,
      actor,
      async (tx) => {
        created = await profileRepository.create(
          childId,
          { ...data, createdById: actor.type === "user" ? actor.userId : null },
          tx,
        );
      },
      { meta, sourceInstitutionId: data.sourceInstitutionId },
    );
    return { item: created!, ...result };
  },

  async addItems(actor: Actor, childId: string, inputs: ProfileItemInput[], meta?: RequestMeta) {
    await authorizationService.assert(actor, "profile.update", childId);
    const rows = inputs.map(validateInput);
    if (rows.length === 0) return { version: 0, changes: [] as ProfileChange[] };
    return applyVersionedChange(
      childId,
      actor,
      async (tx) => {
        for (const row of rows) {
          await profileRepository.create(
            childId,
            { ...row, createdById: actor.type === "user" ? actor.userId : null },
            tx,
          );
        }
      },
      { meta },
    );
  },

  async updateItem(
    actor: Actor,
    childId: string,
    itemId: string,
    input: Partial<ProfileItemInput>,
    meta?: RequestMeta,
  ) {
    await authorizationService.assert(actor, "profile.update", childId);
    const existing = await profileRepository.findActive(childId, itemId);
    if (!existing) throw new AppError("NOT_FOUND", "Profile item not found");
    const merged = validateInput({
      section: existing.section,
      itemType: input.itemType ?? existing.itemType,
      label: input.label ?? existing.label,
      details: input.details === undefined ? existing.details : input.details,
      data: input.data === undefined ? (existing.data as Record<string, unknown> | null) : input.data,
      criticality: input.criticality ?? existing.criticality,
      provenance: input.provenance ?? existing.provenance,
      sourceType: input.sourceType ?? existing.sourceType,
      sourceLabel: input.sourceLabel === undefined ? existing.sourceLabel : input.sourceLabel,
    });
    return applyVersionedChange(
      childId,
      actor,
      async (tx) => {
        await profileRepository.update(itemId, merged, tx);
      },
      { meta },
    );
  },

  async removeItem(actor: Actor, childId: string, itemId: string, meta?: RequestMeta) {
    await authorizationService.assert(actor, "profile.update", childId);
    const existing = await profileRepository.findActive(childId, itemId);
    if (!existing) throw new AppError("NOT_FOUND", "Profile item not found");
    return applyVersionedChange(
      childId,
      actor,
      async (tx) => {
        await profileRepository.softDelete(itemId, tx);
      },
      { meta },
    );
  },

  /** Used by the institutions module when a guardian accepts a proposal (already authorized there). */
  async addObservedItem(actor: Actor, childId: string, input: ProfileItemInput, meta?: RequestMeta) {
    return this.addItem(
      actor,
      childId,
      { ...input, provenance: "OBSERVED", sourceType: input.sourceType ?? "INSTITUTION" },
      meta,
    );
  },

  /** "What's changed since version N?" restricted to the categories the viewer can see. */
  async changesSince(
    childId: string,
    sinceVersion: number,
    allowedCategories: DataCategory[],
  ): Promise<ProfileChange[]> {
    const versions = await profileRepository.listVersionsAfter(childId, sinceVersion);
    const all = versions.flatMap((v) => (Array.isArray(v.changes) ? (v.changes as unknown as ProfileChange[]) : []));
    return filterChangesForViewer(collapseChanges(all), allowedCategories);
  },

  async listVersions(actor: Actor, childId: string, limit = 20) {
    await authorizationService.assert(actor, "audit.read", childId);
    return profileRepository.listVersions(childId, limit);
  },
};

/** Which sections have at least one item — drives the "profile completed" indicator. */
export function completeness(items: Pick<ProfileItem, "section">[]): {
  filled: ProfileSectionValue[];
  percent: number;
} {
  const filled = PROFILE_SECTIONS.filter((s) => items.some((i) => i.section === s));
  return { filled: [...filled], percent: Math.round((filled.length / PROFILE_SECTIONS.length) * 100) };
}

export function criticalItems(items: ProfileItem[]): ProfileItem[] {
  return items.filter((i) => i.criticality === "CRITICAL");
}

export function itemsByCategory(items: ProfileItem[]): Map<DataCategory, ProfileItem[]> {
  const map = new Map<DataCategory, ProfileItem[]>();
  for (const item of items) {
    const cat = categoryOf(item.section, item.itemType);
    const list = map.get(cat) ?? [];
    list.push(item);
    map.set(cat, list);
  }
  return map;
}

/** Filters items to the categories an access allows. */
export function filterItemsByCategories(items: ProfileItem[], allowed: DataCategory[]): ProfileItem[] {
  const set = new Set(allowed);
  return items.filter((i) => set.has(categoryOf(i.section, i.itemType)));
}
