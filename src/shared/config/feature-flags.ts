import { env } from "./env";

export type FeatureFlag = "AI_PROFILE_ASSISTANT" | "INSTITUTION_PORTAL" | "DOCUMENT_VERIFICATION";

/**
 * Minimal feature-flag system. Flags are resolved from the environment so that
 * experimental capabilities can be toggled per deployment without code changes.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  const e = env();
  switch (flag) {
    case "AI_PROFILE_ASSISTANT":
      return e.FEATURE_AI_PROFILE_ASSISTANT;
    case "INSTITUTION_PORTAL":
      return e.FEATURE_INSTITUTION_PORTAL;
    case "DOCUMENT_VERIFICATION":
      return e.FEATURE_DOCUMENT_VERIFICATION;
  }
}
