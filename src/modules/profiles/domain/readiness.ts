import { PROFILE_SECTIONS, type ProfileSectionValue } from "@/shared/domain/care-vocabulary";

/**
 * Care Readiness: is the information a caregiver needs to keep this child safe
 * present and current? It is deliberately separate from "how much of the
 * profile is filled in" (enrichment) so that families are never pushed to
 * over-share just to reach 100 % (docs/12-privacy-by-design.md).
 */
export type ReadinessState = "UNKNOWN" | "NONE_DECLARED" | "HAS_DATA" | "NEEDS_REVIEW";

export interface ReadinessItem {
  section: ProfileSectionValue;
  itemType: string;
  updatedAt: Date | string;
}

export interface ReadinessCheck {
  key: "allergies" | "medications" | "emergencyContact";
  state: ReadinessState;
  updatedAt: Date | null;
}

export interface CareReadiness {
  checks: ReadinessCheck[];
  /** 0–100: share of checks in HAS_DATA or NONE_DECLARED. */
  percent: number;
  ready: boolean;
  needsReview: boolean;
}

/** Declarations and safety facts older than this must be re-confirmed. */
export const REVIEW_AFTER_DAYS = 365;

function latest(items: ReadinessItem[]): Date | null {
  return items.reduce<Date | null>((max, i) => {
    const d = new Date(i.updatedAt);
    return !max || d > max ? d : max;
  }, null);
}

function evaluate(dataItems: ReadinessItem[], declarations: ReadinessItem[], now: Date): ReadinessCheck["state"] {
  const source = dataItems.length ? dataItems : declarations;
  if (source.length === 0) return "UNKNOWN";
  const last = latest(source)!;
  const ageDays = (now.getTime() - last.getTime()) / 86_400_000;
  if (ageDays > REVIEW_AFTER_DAYS) return "NEEDS_REVIEW";
  return dataItems.length ? "HAS_DATA" : "NONE_DECLARED";
}

export type ReadinessKey = ReadinessCheck["key"];

/** Maps a shared data category to the readiness check it makes visible. */
export const READINESS_KEY_BY_CATEGORY: Record<string, ReadinessKey> = {
  ALLERGIES: "allergies",
  MEDICATION: "medications",
  EMERGENCY: "emergencyContact",
};

export function careReadiness(
  items: ReadinessItem[],
  opts: { now?: Date; only?: ReadinessKey[] } = {},
): CareReadiness {
  const now = opts.now ?? new Date();
  const allergies = items.filter((i) => (i.section === "HEALTH" && i.itemType === "ALLERGY") || (i.section === "NUTRITION" && i.itemType === "FOOD_ALLERGY"));
  const noAllergies = items.filter((i) => i.itemType === "NO_KNOWN_ALLERGIES");
  const meds = items.filter((i) => i.section === "HEALTH" && i.itemType === "MEDICATION");
  const noMeds = items.filter((i) => i.itemType === "NO_MEDICATIONS");
  const contacts = items.filter((i) => i.section === "EMERGENCY" && i.itemType === "CONTACT");

  const all: ReadinessCheck[] = [
    { key: "allergies", state: evaluate(allergies, noAllergies, now), updatedAt: latest([...allergies, ...noAllergies]) },
    { key: "medications", state: evaluate(meds, noMeds, now), updatedAt: latest([...meds, ...noMeds]) },
    { key: "emergencyContact", state: evaluate(contacts, [], now), updatedAt: latest(contacts) },
  ];
  const checks = opts.only ? all.filter((c) => opts.only!.includes(c.key)) : all;
  const ok = checks.filter((c) => c.state === "HAS_DATA" || c.state === "NONE_DECLARED").length;
  return {
    checks,
    percent: checks.length ? Math.round((ok / checks.length) * 100) : 0,
    ready: checks.length > 0 && ok === checks.length,
    needsReview: checks.some((c) => c.state === "NEEDS_REVIEW"),
  };
}

/** Sections that enrich care beyond the safety minimum. */
export const ENRICHMENT_SECTIONS: ProfileSectionValue[] = PROFILE_SECTIONS.filter((s) => s !== "EMERGENCY" && s !== "HEALTH");

export function enrichment(items: Pick<ReadinessItem, "section">[]): { filled: ProfileSectionValue[]; percent: number } {
  const filled = ENRICHMENT_SECTIONS.filter((s) => items.some((i) => i.section === s));
  return { filled, percent: Math.round((filled.length / ENRICHMENT_SECTIONS.length) * 100) };
}
