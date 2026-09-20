/**
 * Shared kernel: vocabulary used by profiles, sharing, authorization and care.
 * Pure constants and types — no I/O, no framework imports.
 */

export const DATA_CATEGORIES = [
  "IDENTITY",
  "PHOTO",
  "EMERGENCY",
  "ALLERGIES",
  "MEDICATION",
  "HEALTH",
  "NUTRITION",
  "SLEEP",
  "BATHROOM",
  "COMMUNICATION",
  "COMFORT",
  "PLAY",
  "SOCIAL",
  "DOCUMENTS",
] as const;
export type DataCategory = (typeof DATA_CATEGORIES)[number];

/** Categories a share wizard can toggle (IDENTITY is always included). */
export const SHAREABLE_CATEGORIES: DataCategory[] = DATA_CATEGORIES.filter((c) => c !== "IDENTITY");

export const CAPABILITIES = ["ACKNOWLEDGE", "RUN_CARE_SESSION", "PROPOSE_CHANGES", "VIEW_DOCUMENTS"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const RECIPIENT_KINDS = ["FAMILY", "BABYSITTER", "INSTITUTION", "OTHER"] as const;
export type RecipientKindValue = (typeof RECIPIENT_KINDS)[number];

export type CriticalityValue = "CRITICAL" | "IMPORTANT" | "INFORMATIONAL";
export type Sensitivity = "NORMAL" | "SENSITIVE" | "HIGHLY_SENSITIVE";

export const PROFILE_SECTIONS = [
  "EMERGENCY",
  "HEALTH",
  "NUTRITION",
  "SLEEP",
  "BATHROOM",
  "COMMUNICATION",
  "COMFORT",
  "PLAY",
  "SOCIAL",
] as const;
export type ProfileSectionValue = (typeof PROFILE_SECTIONS)[number];

/** Minimum-necessary defaults per recipient kind (docs/10-permissions-model.md). */
export const DEFAULT_CATEGORIES: Record<RecipientKindValue, DataCategory[]> = {
  FAMILY: ["EMERGENCY", "ALLERGIES", "MEDICATION", "NUTRITION", "SLEEP", "COMFORT", "COMMUNICATION", "BATHROOM"],
  BABYSITTER: ["EMERGENCY", "ALLERGIES", "MEDICATION", "NUTRITION", "SLEEP", "COMFORT", "COMMUNICATION"],
  INSTITUTION: [
    "EMERGENCY",
    "ALLERGIES",
    "MEDICATION",
    "HEALTH",
    "NUTRITION",
    "SLEEP",
    "COMMUNICATION",
    "COMFORT",
    "SOCIAL",
  ],
  OTHER: ["EMERGENCY", "ALLERGIES", "MEDICATION"],
};

export const DEFAULT_CAPABILITIES: Record<RecipientKindValue, Capability[]> = {
  FAMILY: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
  BABYSITTER: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
  INSTITUTION: ["ACKNOWLEDGE", "RUN_CARE_SESSION", "PROPOSE_CHANGES"],
  OTHER: ["ACKNOWLEDGE"],
};

/** Categories whose viewing emits CRITICAL_DATA_VIEWED. */
export const CRITICAL_CATEGORIES: DataCategory[] = ["EMERGENCY", "ALLERGIES", "MEDICATION"];

export const SECTION_SENSITIVITY: Record<ProfileSectionValue, Sensitivity> = {
  EMERGENCY: "SENSITIVE",
  HEALTH: "HIGHLY_SENSITIVE",
  NUTRITION: "SENSITIVE",
  SLEEP: "SENSITIVE",
  BATHROOM: "SENSITIVE",
  COMMUNICATION: "SENSITIVE",
  COMFORT: "SENSITIVE",
  PLAY: "NORMAL",
  SOCIAL: "NORMAL",
};

export const CATEGORY_SENSITIVITY: Record<DataCategory, Sensitivity> = {
  IDENTITY: "SENSITIVE",
  PHOTO: "SENSITIVE",
  EMERGENCY: "SENSITIVE",
  ALLERGIES: "HIGHLY_SENSITIVE",
  MEDICATION: "HIGHLY_SENSITIVE",
  HEALTH: "HIGHLY_SENSITIVE",
  NUTRITION: "SENSITIVE",
  SLEEP: "SENSITIVE",
  BATHROOM: "SENSITIVE",
  COMMUNICATION: "SENSITIVE",
  COMFORT: "SENSITIVE",
  PLAY: "NORMAL",
  SOCIAL: "NORMAL",
  DOCUMENTS: "HIGHLY_SENSITIVE",
};

export function isDataCategory(value: string): value is DataCategory {
  return (DATA_CATEGORIES as readonly string[]).includes(value);
}

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}
