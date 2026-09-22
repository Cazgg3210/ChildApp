import { describe, expect, it } from "vitest";
import { careReadiness, enrichment, type ReadinessItem } from "@/modules/profiles/domain/readiness";
import { partitionForCarePass } from "@/modules/profiles/domain/care-pass-layout";

const now = new Date("2026-09-21T12:00:00Z");
const recent = new Date("2026-08-01T00:00:00Z");
const stale = new Date("2025-01-01T00:00:00Z");

const item = (section: ReadinessItem["section"], itemType: string, updatedAt = recent): ReadinessItem => ({
  section,
  itemType,
  updatedAt,
});

describe("careReadiness", () => {
  it("is UNKNOWN for everything on an empty profile — and therefore not ready", () => {
    const r = careReadiness([], { now });
    expect(r.checks.map((c) => c.state)).toEqual(["UNKNOWN", "UNKNOWN", "UNKNOWN"]);
    expect(r.ready).toBe(false);
    expect(r.percent).toBe(0);
  });

  it("treats explicit 'none declared' facts as ready, distinct from missing data", () => {
    const r = careReadiness(
      [item("HEALTH", "NO_KNOWN_ALLERGIES"), item("HEALTH", "NO_MEDICATIONS"), item("EMERGENCY", "CONTACT")],
      { now },
    );
    expect(r.checks.map((c) => c.state)).toEqual(["NONE_DECLARED", "NONE_DECLARED", "HAS_DATA"]);
    expect(r.ready).toBe(true);
    expect(r.percent).toBe(100);
  });

  it("counts food allergies as allergy information", () => {
    const r = careReadiness([item("NUTRITION", "FOOD_ALLERGY")], { now });
    expect(r.checks[0].state).toBe("HAS_DATA");
  });

  it("flags facts older than a year for re-confirmation", () => {
    const r = careReadiness([item("HEALTH", "ALLERGY", stale), item("HEALTH", "NO_MEDICATIONS", stale)], { now });
    expect(r.checks[0].state).toBe("NEEDS_REVIEW");
    expect(r.checks[1].state).toBe("NEEDS_REVIEW");
    expect(r.needsReview).toBe(true);
    expect(r.ready).toBe(false);
  });

  it("restricts the checks to the categories an institution can see", () => {
    const r = careReadiness([item("HEALTH", "NO_KNOWN_ALLERGIES")], { now, only: ["allergies"] });
    expect(r.checks).toHaveLength(1);
    expect(r.ready).toBe(true);
  });
});

describe("enrichment", () => {
  it("never counts the safety sections", () => {
    expect(enrichment([{ section: "HEALTH" }, { section: "EMERGENCY" }]).percent).toBe(0);
    expect(enrichment([{ section: "SLEEP" }]).filled).toEqual(["SLEEP"]);
  });
});

describe("partitionForCarePass", () => {
  it("keeps every allergy/medication/emergency item visible, whatever its criticality", () => {
    const items = [
      { id: "1", section: "HEALTH", itemType: "ALLERGY", criticality: "INFORMATIONAL" },
      { id: "2", section: "HEALTH", itemType: "NO_MEDICATIONS", criticality: "INFORMATIONAL" },
      { id: "3", section: "SLEEP", itemType: "SCHEDULE", criticality: "IMPORTANT" },
      { id: "4", section: "PLAY", itemType: "TOY", criticality: "CRITICAL" },
    ] as const;
    type Row = (typeof items)[number];
    const { highlighted, groups } = partitionForCarePass<Row>([...items]);
    // CRITICAL first, then the safety-category items regardless of their criticality.
    expect(highlighted.map((i) => i.id)).toEqual(["4", "1", "2"]);
    expect(groups.flatMap((g) => g.items.map((i) => i.id))).toEqual(["3"]);
  });
});
