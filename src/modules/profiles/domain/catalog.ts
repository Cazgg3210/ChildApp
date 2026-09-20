import type { CriticalityValue, DataCategory, ProfileSectionValue } from "@/shared/domain/care-vocabulary";

/**
 * Catalog of item types per profile section. Stored as strings in the DB and
 * validated here, so the catalog can grow without schema migrations.
 */
export const ITEM_TYPES = {
  EMERGENCY: ["CONTACT", "HOSPITAL", "DOCTOR", "EMERGENCY_NUMBER"],
  HEALTH: ["ALLERGY", "MEDICATION", "CONDITION", "VACCINE", "SPECIAL_NEED", "MEDICAL_INSTRUCTION"],
  NUTRITION: ["RESTRICTED_FOOD", "FOOD_ALLERGY", "INTOLERANCE", "ALLOWED_FOOD", "PREFERENCE", "FEEDING_ROUTINE"],
  SLEEP: ["SCHEDULE", "ROUTINE", "DURATION", "COMFORT_OBJECT", "NEED"],
  BATHROOM: ["TOILET_TRAINING", "DIAPER", "FREQUENCY", "INSTRUCTION"],
  COMMUNICATION: ["LANGUAGE", "WORD", "NEED_EXPRESSION", "NONVERBAL_CUE", "HELP_REQUEST"],
  COMFORT: ["PREFERRED_OBJECT", "SOOTHING_STRATEGY", "TRIGGER"],
  PLAY: ["TOY", "GAME", "CHARACTER", "STORY", "MUSIC", "ACTIVITY", "INTEREST"],
  SOCIAL: ["OBSERVATION"],
} as const satisfies Record<ProfileSectionValue, readonly string[]>;

export type ItemType = (typeof ITEM_TYPES)[ProfileSectionValue][number];

export function isItemTypeOf(section: ProfileSectionValue, itemType: string): itemType is ItemType {
  return (ITEM_TYPES[section] as readonly string[]).includes(itemType);
}

const CRITICAL_TYPES = new Set<string>(["CONTACT", "ALLERGY", "MEDICATION", "FOOD_ALLERGY", "EMERGENCY_NUMBER"]);
const IMPORTANT_TYPES = new Set<string>([
  "HOSPITAL",
  "DOCTOR",
  "CONDITION",
  "SPECIAL_NEED",
  "MEDICAL_INSTRUCTION",
  "RESTRICTED_FOOD",
  "INTOLERANCE",
  "FEEDING_ROUTINE",
  "SCHEDULE",
  "ROUTINE",
  "NEED",
  "COMFORT_OBJECT",
  "TOILET_TRAINING",
  "DIAPER",
  "INSTRUCTION",
  "NEED_EXPRESSION",
  "HELP_REQUEST",
  "NONVERBAL_CUE",
  "SOOTHING_STRATEGY",
  "TRIGGER",
]);

/** Default visual hierarchy: CRITICAL > IMPORTANT > INFORMATIONAL. Guardians may override per item. */
export function defaultCriticality(itemType: string): CriticalityValue {
  if (CRITICAL_TYPES.has(itemType)) return "CRITICAL";
  if (IMPORTANT_TYPES.has(itemType)) return "IMPORTANT";
  return "INFORMATIONAL";
}

/**
 * Sharing granularity is coarser than sections for most data, but finer for
 * health: allergies and medication are shareable independently of the medical
 * history.
 */
export function categoryOf(section: ProfileSectionValue, itemType: string): DataCategory {
  if (section === "HEALTH") {
    if (itemType === "ALLERGY") return "ALLERGIES";
    if (itemType === "MEDICATION") return "MEDICATION";
    return "HEALTH";
  }
  if (section === "NUTRITION" && itemType === "FOOD_ALLERGY") return "ALLERGIES";
  return section;
}

/** UI grouping of sections into screens (docs/04-user-journeys.md). */
export const SECTION_GROUPS = {
  emergency: ["EMERGENCY"],
  health: ["HEALTH"],
  food: ["NUTRITION"],
  routine: ["SLEEP", "BATHROOM"],
  wellbeing: ["COMMUNICATION", "COMFORT"],
  interests: ["PLAY", "SOCIAL"],
} as const satisfies Record<string, readonly ProfileSectionValue[]>;

export type SectionGroupKey = keyof typeof SECTION_GROUPS;

export function groupOfSection(section: ProfileSectionValue): SectionGroupKey {
  for (const [key, sections] of Object.entries(SECTION_GROUPS)) {
    if ((sections as readonly string[]).includes(section)) return key as SectionGroupKey;
  }
  return "interests";
}

export function isSectionGroup(value: string): value is SectionGroupKey {
  return value in SECTION_GROUPS;
}

/** Structured extra fields per item type (rendered as inputs; stored in `data`). */
export const ITEM_DATA_FIELDS: Partial<Record<ItemType, readonly { key: string; kind: "text" | "tel" | "time" }[]>> = {
  CONTACT: [
    { key: "relationship", kind: "text" },
    { key: "phone", kind: "tel" },
  ],
  HOSPITAL: [{ key: "phone", kind: "tel" }],
  DOCTOR: [{ key: "phone", kind: "tel" }],
  EMERGENCY_NUMBER: [{ key: "phone", kind: "tel" }],
  ALLERGY: [
    { key: "severity", kind: "text" },
    { key: "reaction", kind: "text" },
  ],
  FOOD_ALLERGY: [
    { key: "severity", kind: "text" },
    { key: "reaction", kind: "text" },
  ],
  MEDICATION: [
    { key: "dose", kind: "text" },
    { key: "schedule", kind: "text" },
  ],
  SCHEDULE: [{ key: "time", kind: "time" }],
  FEEDING_ROUTINE: [{ key: "time", kind: "time" }],
};
