import { CRITICAL_CATEGORIES, DATA_CATEGORIES, type DataCategory } from "@/shared/domain/care-vocabulary";
import { categoryOf } from "./catalog";

/** Minimal item shape needed to lay out a care view. */
export interface LayoutItem {
  section: Parameters<typeof categoryOf>[0];
  itemType: string;
  criticality: "CRITICAL" | "IMPORTANT" | "INFORMATIONAL";
}

/** Display order for the non-highlighted categories. Every category has a slot; unknown ones go last. */
export const CARE_PASS_CATEGORY_ORDER: DataCategory[] = [
  "NUTRITION",
  "SLEEP",
  "BATHROOM",
  "COMFORT",
  "COMMUNICATION",
  "HEALTH",
  "PLAY",
  "SOCIAL",
  "DOCUMENTS",
  "PHOTO",
  "IDENTITY",
];

/**
 * Splits authorized items into the "IMPORTANT" block and the rest.
 *
 * Rule (docs/09-security-model.md → "criticality never decides visibility"):
 *  - the sharing category decides whether an item is shown at all (already
 *    filtered by the caller);
 *  - EVERY item in a safety category (emergency, allergies, medication) goes to
 *    the highlighted block regardless of its criticality;
 *  - a CRITICAL item from any other category is also lifted to the block;
 *  - criticality only affects ordering and styling.
 * Nothing authorized is ever dropped.
 */
export function partitionForCarePass<T extends LayoutItem>(items: T[]): { highlighted: T[]; groups: { category: DataCategory; items: T[] }[] } {
  const rank = { CRITICAL: 0, IMPORTANT: 1, INFORMATIONAL: 2 } as const;
  const highlighted: T[] = [];
  const rest = new Map<DataCategory, T[]>();
  for (const item of items) {
    const category = categoryOf(item.section, item.itemType);
    if (CRITICAL_CATEGORIES.includes(category) || item.criticality === "CRITICAL") {
      highlighted.push(item);
      continue;
    }
    rest.set(category, [...(rest.get(category) ?? []), item]);
  }
  highlighted.sort((a, b) => rank[a.criticality] - rank[b.criticality]);
  const order = [...CARE_PASS_CATEGORY_ORDER, ...DATA_CATEGORIES.filter((c) => !CARE_PASS_CATEGORY_ORDER.includes(c))];
  const groups = order.filter((c) => rest.has(c)).map((category) => ({ category, items: rest.get(category)! }));
  return { highlighted, groups };
}
