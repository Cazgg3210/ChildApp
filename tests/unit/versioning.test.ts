import { describe, expect, it } from "vitest";
import {
  collapseChanges,
  computeChanges,
  filterChangesForViewer,
  hasCriticalChange,
  summarizeChanges,
  type SnapshotItem,
} from "@/modules/profiles/domain/versioning";
import { categoryOf, defaultCriticality, isItemTypeOf } from "@/modules/profiles/domain/catalog";

function item(overrides: Partial<SnapshotItem> & { id: string }): SnapshotItem {
  return {
    section: "HEALTH",
    itemType: "ALLERGY",
    label: "Peanut",
    details: null,
    data: null,
    criticality: "CRITICAL",
    provenance: "SELF_DECLARED",
    sourceType: "GUARDIAN",
    sourceLabel: null,
    updatedAt: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

describe("computeChanges", () => {
  it("detects additions, updates and removals by item id", () => {
    const before = [
      item({ id: "a" }),
      item({ id: "b", section: "SLEEP", itemType: "SCHEDULE", label: "Nap", criticality: "IMPORTANT" }),
    ];
    const after = [
      item({ id: "a", details: "Use EpiPen" }),
      item({
        id: "c",
        section: "COMFORT",
        itemType: "PREFERRED_OBJECT",
        label: "Blue dinosaur",
        criticality: "INFORMATIONAL",
      }),
    ];
    const changes = computeChanges(before, after);
    expect(changes.map((c) => [c.op, c.itemId])).toEqual([
      ["UPDATED", "a"],
      ["ADDED", "c"],
      ["REMOVED", "b"],
    ]);
    expect(changes.find((c) => c.itemId === "a")).toMatchObject({ category: "ALLERGIES", critical: true });
    expect(changes.find((c) => c.itemId === "b")).toMatchObject({ category: "SLEEP", critical: false });
  });

  it("ignores updatedAt-only differences and ordering", () => {
    const before = [item({ id: "a" }), item({ id: "b", label: "Milk" })];
    const after = [
      item({ id: "b", label: "Milk", updatedAt: "2026-09-11T00:00:00Z" }),
      item({ id: "a", updatedAt: "2026-09-12T00:00:00Z" }),
    ];
    expect(computeChanges(before, after)).toEqual([]);
  });

  it("flags critical changes", () => {
    expect(hasCriticalChange(computeChanges([], [item({ id: "a" })]))).toBe(true);
    expect(hasCriticalChange(computeChanges([], [item({ id: "a", criticality: "INFORMATIONAL" })]))).toBe(false);
  });
});

describe("collapseChanges / filterChangesForViewer", () => {
  it("collapses ADDED+UPDATED into ADDED and ADDED+REMOVED into nothing", () => {
    const a = computeChanges([], [item({ id: "a" })]);
    const aUpdated = computeChanges([item({ id: "a" })], [item({ id: "a", details: "x" })]);
    const b = computeChanges([], [item({ id: "b" })]);
    const bRemoved = computeChanges([item({ id: "b" })], []);
    const collapsed = collapseChanges([...a, ...aUpdated, ...b, ...bRemoved]);
    expect(collapsed).toHaveLength(1);
    expect(collapsed[0]).toMatchObject({ itemId: "a", op: "ADDED" });
  });

  it("only keeps categories the viewer is allowed to see", () => {
    const changes = computeChanges(
      [],
      [
        item({ id: "a" }),
        item({ id: "b", section: "BATHROOM", itemType: "DIAPER", label: "Diaper", criticality: "IMPORTANT" }),
      ],
    );
    const visible = filterChangesForViewer(changes, ["IDENTITY", "ALLERGIES"]);
    expect(visible.map((c) => c.itemId)).toEqual(["a"]);
  });

  it("summarizes deterministically", () => {
    expect(summarizeChanges([])).toBe("no changes");
    expect(summarizeChanges(computeChanges([], [item({ id: "a" }), item({ id: "b" })]))).toBe("ADDED:ALLERGIESx2");
  });
});

describe("catalog", () => {
  it("maps health items to fine-grained sharing categories", () => {
    expect(categoryOf("HEALTH", "ALLERGY")).toBe("ALLERGIES");
    expect(categoryOf("HEALTH", "MEDICATION")).toBe("MEDICATION");
    expect(categoryOf("HEALTH", "CONDITION")).toBe("HEALTH");
    expect(categoryOf("NUTRITION", "FOOD_ALLERGY")).toBe("ALLERGIES");
    expect(categoryOf("SLEEP", "ROUTINE")).toBe("SLEEP");
  });

  it("derives default criticality from the item type", () => {
    expect(defaultCriticality("ALLERGY")).toBe("CRITICAL");
    expect(defaultCriticality("CONTACT")).toBe("CRITICAL");
    expect(defaultCriticality("ROUTINE")).toBe("IMPORTANT");
    expect(defaultCriticality("TOY")).toBe("INFORMATIONAL");
  });

  it("validates item types per section", () => {
    expect(isItemTypeOf("HEALTH", "ALLERGY")).toBe(true);
    expect(isItemTypeOf("SLEEP", "ALLERGY")).toBe(false);
    expect(isItemTypeOf("SOCIAL", "OBSERVATION")).toBe(true);
  });
});
