import { z } from "zod";

/** "false"/"0"/"no" must be false — z.coerce.boolean() would turn any non-empty string into true. */
const envBoolean = (fallback: boolean) =>
  z.preprocess((v) => {
    if (v === undefined || v === "") return fallback;
    if (typeof v === "string") return ["1", "true", "yes", "on"].includes(v.trim().toLowerCase());
    return Boolean(v);
  }, z.boolean());

/**
 * Environment configuration, validated once at startup.
 * Fail fast: a misconfigured deployment must not boot.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  SHARE_BASE_URL: z.string().url().optional(),
  DATABASE_URL: z.string().min(1),
  AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters"),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),
  AUTH_APPLE_ID: z.string().optional(),
  AUTH_APPLE_SECRET: z.string().optional(),
  MAILER_PROVIDER: z.enum(["console", "smtp"]).default("console"),
  SMTP_URL: z.string().optional(),
  MAIL_FROM: z.string().default("Child Care Passport <no-reply@localhost>"),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default("./storage"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: envBoolean(true),
  AI_PROVIDER: z.enum(["heuristic", "anthropic", "openai"]).default("heuristic"),
  AI_API_KEY: z.string().optional(),
  FEATURE_AI_PROFILE_ASSISTANT: envBoolean(true),
  FEATURE_INSTITUTION_PORTAL: envBoolean(true),
  FEATURE_DOCUMENT_VERIFICATION: envBoolean(false),
  SEED_DEMO: envBoolean(false),
  DEMO_PASSWORD: z.string().default("Demo1234!secure"),
  ALLOW_DEMO_SEED: envBoolean(false),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
});

export type Env = z.infer<typeof schema>;

function load(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

let cached: Env | undefined;

export function env(): Env {
  if (!cached) cached = load();
  return cached;
}

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}

export function shareBaseUrl(): string {
  const e = env();
  return (e.SHARE_BASE_URL ?? e.APP_URL).replace(/\/$/, "");
}
