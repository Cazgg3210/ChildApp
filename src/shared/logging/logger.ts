import pino from "pino";
import { env } from "@/shared/config/env";

/**
 * Structured logger. Sensitive fields are redacted so that tokens, PINs and
 * passwords never reach log storage. Profile contents are never logged.
 */
export const logger = pino({
  level: env().LOG_LEVEL,
  redact: {
    paths: [
      "password",
      "*.password",
      "token",
      "*.token",
      "pin",
      "*.pin",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
    ],
    censor: "[REDACTED]",
  },
  base: { service: "child-care-passport" },
});

export type Logger = typeof logger;
