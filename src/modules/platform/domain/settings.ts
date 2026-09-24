import { z } from "zod";

/**
 * Runtime settings editable by platform administrators. Each key is stored as
 * one `PlatformSetting` row; anything absent falls back to the environment
 * (src/shared/config/env.ts), so a deployment works with env vars alone.
 */
export const mailSettingsSchema = z.object({
  provider: z.enum(["console", "smtp"]),
  host: z.string().trim().max(200).default(""),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().trim().max(200).default(""),
  /** Encrypted with AUTH_SECRET; never returned to the browser. */
  passwordEnc: z.string().default(""),
  from: z.string().trim().max(200).default(""),
});
export type MailSettings = z.infer<typeof mailSettingsSchema>;

export const securitySettingsSchema = z.object({
  requireEmailVerification: z.boolean(),
});
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const featureSettingsSchema = z.object({
  aiProfileAssistant: z.boolean(),
  institutionPortal: z.boolean(),
  documentVerification: z.boolean(),
});
export type FeatureSettings = z.infer<typeof featureSettingsSchema>;

export const SETTING_KEYS = { mail: "mail", security: "security", features: "features" } as const;
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

/** Where an effective value comes from — shown in the admin UI. */
export type SettingSource = "database" | "environment";
