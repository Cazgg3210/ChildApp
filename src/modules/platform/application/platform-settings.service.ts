import { env } from "@/shared/config/env";
import { openSecret, sealSecret } from "@/shared/security/secretbox";
import { settingsRepository } from "../infrastructure/settings.repository";
import {
  featureSettingsSchema,
  mailSettingsSchema,
  securitySettingsSchema,
  SETTING_KEYS,
  type FeatureSettings,
  type MailSettings,
  type SecuritySettings,
  type SettingSource,
} from "../domain/settings";

const CACHE_TTL_MS = 10_000;
let cache: { at: number; rows: Map<string, unknown> } | undefined;

async function rows(): Promise<Map<string, unknown>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.rows;
  const list = await settingsRepository.list();
  cache = { at: Date.now(), rows: new Map(list.map((r) => [r.key, r.value])) };
  return cache.rows;
}

/** Parses the env SMTP_URL (smtp[s]://user:pass@host:port) into the same shape the admin form uses. */
function mailFromEnv(): MailSettings {
  const e = env();
  const base: MailSettings = {
    provider: e.MAILER_PROVIDER,
    host: "",
    port: 587,
    secure: false,
    user: "",
    passwordEnc: "",
    from: e.MAIL_FROM,
  };
  if (!e.SMTP_URL) return base;
  try {
    const u = new URL(e.SMTP_URL);
    return {
      ...base,
      host: u.hostname,
      port: Number(u.port) || (u.protocol === "smtps:" ? 465 : 587),
      secure: u.protocol === "smtps:",
      user: decodeURIComponent(u.username),
      passwordEnc: u.password ? sealSecret(decodeURIComponent(u.password)) : "",
    };
  } catch {
    return base;
  }
}

/**
 * Effective runtime configuration: database rows (edited in /admin) override
 * the environment. Read paths are cached briefly so hot paths (mailer,
 * feature flags, verification gate) do not hit the database every call.
 */
export const platformSettingsService = {
  invalidate() {
    cache = undefined;
  },

  async mail(): Promise<{ value: MailSettings; source: SettingSource }> {
    const stored = (await rows()).get(SETTING_KEYS.mail);
    const parsed = stored ? mailSettingsSchema.safeParse(stored) : null;
    if (parsed?.success) return { value: parsed.data, source: "database" };
    return { value: mailFromEnv(), source: "environment" };
  },

  /** Plaintext SMTP password for the transport; never exposed to the UI. */
  async mailPassword(): Promise<string> {
    const { value } = await this.mail();
    return value.passwordEnc ? (openSecret(value.passwordEnc) ?? "") : "";
  },

  async security(): Promise<{ value: SecuritySettings; source: SettingSource }> {
    const stored = (await rows()).get(SETTING_KEYS.security);
    const parsed = stored ? securitySettingsSchema.safeParse(stored) : null;
    if (parsed?.success) return { value: parsed.data, source: "database" };
    return { value: { requireEmailVerification: env().REQUIRE_EMAIL_VERIFICATION }, source: "environment" };
  },

  async features(): Promise<{ value: FeatureSettings; source: SettingSource }> {
    const stored = (await rows()).get(SETTING_KEYS.features);
    const parsed = stored ? featureSettingsSchema.safeParse(stored) : null;
    if (parsed?.success) return { value: parsed.data, source: "database" };
    const e = env();
    return {
      value: {
        aiProfileAssistant: e.FEATURE_AI_PROFILE_ASSISTANT,
        institutionPortal: e.FEATURE_INSTITUTION_PORTAL,
        documentVerification: e.FEATURE_DOCUMENT_VERIFICATION,
      },
      source: "environment",
    };
  },

  async saveMail(input: Omit<MailSettings, "passwordEnc"> & { password?: string | null }, updatedById: string) {
    const current = await this.mail();
    // Empty password keeps the stored one (the form never shows it).
    const passwordEnc = input.password ? sealSecret(input.password) : current.value.passwordEnc;
    const value = mailSettingsSchema.parse({ ...input, passwordEnc });
    await settingsRepository.set(SETTING_KEYS.mail, value, updatedById);
    this.invalidate();
    return value;
  },

  async saveSecurity(input: SecuritySettings, updatedById: string) {
    const value = securitySettingsSchema.parse(input);
    await settingsRepository.set(SETTING_KEYS.security, value, updatedById);
    this.invalidate();
    return value;
  },

  async saveFeatures(input: FeatureSettings, updatedById: string) {
    const value = featureSettingsSchema.parse(input);
    await settingsRepository.set(SETTING_KEYS.features, value, updatedById);
    this.invalidate();
    return value;
  },

  /** Removes the database override so the environment applies again. */
  async resetToEnvironment(key: keyof typeof SETTING_KEYS) {
    await settingsRepository.remove(SETTING_KEYS[key]);
    this.invalidate();
  },
};
