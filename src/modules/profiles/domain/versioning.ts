import type { CriticalityValue, DataCategory, ProfileSectionValue } from "@/shared/domain/care-vocabulary";
import { categoryOf } from "./catalog";

/** Minimal, storage-agnostic representation of a profile item used for snapshots and diffs. */
export interface SnapshotItem {
  id: string;
  section: ProfileSectionValue;
  itemType: string;
  label: string;
  details: string | null;
  data: unknown;
  criticality: CriticalityValue;
  provenance: string;
  sourceType: string;
  sourceLabel: string | null;
  updatedAt: string;
}

export type ChangeOp = "ADDED" | "UPDATED" | "REMOVED";

export interface ProfileChange {
  op: ChangeOp;
  itemId: string;
  section: ProfileSectionValue;
  category: DataCategory;
  itemType: string;
  label: string;
  critical: boolean;
}

function fingerprint(item: SnapshotItem): string {
  return JSON.stringify([
    item.label,
    item.details,
    item.data ?? null,
    item.criticality,
    item.provenance,
    item.sourceType,
    item.sourceLabel,
    item.section,
    item.itemType,
  ]);
}

/** Pure diff between two snapshots. Order-insensitive; keyed by item id. */
export function computeChanges(previous: SnapshotItem[], next: SnapshotItem[]): ProfileChange[] {
  const prevById = new Map(previous.map((i) => [i.id, i]));
  const nextById = new Map(next.map((i) => [i.id, i]));
  const changes: ProfileChange[] = [];

  for (const item of next) {
    const before = prevById.get(item.id);
    if (!before) changes.push(toChange("ADDED", item));
    else if (fingerprint(before) !== fingerprint(item)) changes.push(toChange("UPDATED", item));
  }
  for (const item of previous) {
    if (!nextById.has(item.id)) changes.push(toChange("REMOVED", item));
  }
  return changes;
}

function toChange(op: ChangeOp, item: SnapshotItem): ProfileChange {
  return {
    op,
    itemId: item.id,
    section: item.section,
    category: categoryOf(item.section, item.itemType),
    itemType: item.itemType,
    label: item.label,
    critical: item.criticality === "CRITICAL",
  };
}

export function hasCriticalChange(changes: ProfileChange[]): boolean {
  return changes.some((c) => c.critical);
}

/** Aggregates changes from several versions, keeping only categories the viewer may see. */
export function filterChangesForViewer(changes: ProfileChange[], allowedCategories: DataCategory[]): ProfileChange[] {
  const allowed = new Set(allowedCategories);
  return changes.filter((c) => allowed.has(c.category));
}

/** Collapses repeated changes to the same item into the most recent op (ADDED then UPDATED → ADDED). */
export function collapseChanges(changes: ProfileChange[]): ProfileChange[] {
  const byItem = new Map<string, ProfileChange>();
  for (const c of changes) {
    const prev = byItem.get(c.itemId);
    if (!prev) {
      byItem.set(c.itemId, c);
      continue;
    }
    if (prev.op === "ADDED" && c.op === "REMOVED") {
      byItem.delete(c.itemId);
      continue;
    }
    if (prev.op === "ADDED") continue; // stays ADDED
    byItem.set(c.itemId, c);
  }
  return [...byItem.values()];
}

/** Human-neutral summary string stored with the version (UI translates per category). */
export function summarizeChanges(changes: ProfileChange[]): string {
  if (changes.length === 0) return "no changes";
  const parts = new Map<string, number>();
  for (const c of changes) parts.set(`${c.op}:${c.category}`, (parts.get(`${c.op}:${c.category}`) ?? 0) + 1);
  return [...parts.entries()].map(([k, n]) => `${k}x${n}`).join(", ");
}
