/**
 * Observability hook (Next.js instrumentation). Kept intentionally small:
 * structured logging via pino is already active; Sentry / OpenTelemetry attach
 * here in V1 without touching application code (docs/07-architecture.md).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { logger } = await import("@/shared/logging/logger");
  const { env } = await import("@/shared/config/env");
  const e = env();
  logger.info(
    {
      nodeEnv: e.NODE_ENV,
      storage: e.STORAGE_PROVIDER,
      mailer: e.MAILER_PROVIDER,
      ai: e.AI_PROVIDER,
      flags: { ai: e.FEATURE_AI_PROFILE_ASSISTANT, institutions: e.FEATURE_INSTITUTION_PORTAL },
    },
    "child-care-passport booting",
  );
}
