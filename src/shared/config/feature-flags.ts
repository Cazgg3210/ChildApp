import { platformSettingsService } from "@/modules/platform/application/platform-settings.service";

export type FeatureFlag = "AI_PROFILE_ASSISTANT" | "INSTITUTION_PORTAL" | "DOCUMENT_VERIFICATION";

/**
 * Feature flags: resolved from the platform settings (editable in /admin),
 * which fall back to the FEATURE_* environment variables.
 */
export async function isFeatureEnabled(flag: FeatureFlag): Promise<boolean> {
  const { value } = await platformSettingsService.features();
  switch (flag) {
    case "AI_PROFILE_ASSISTANT":
      return value.aiProfileAssistant;
    case "INSTITUTION_PORTAL":
      return value.institutionPortal;
    case "DOCUMENT_VERIFICATION":
      return value.documentVerification;
  }
}
