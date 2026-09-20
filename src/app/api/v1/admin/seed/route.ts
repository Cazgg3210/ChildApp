import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { apiHandler } from "@/shared/http/api";
import { AppError } from "@/shared/errors/app-error";
import { env } from "@/shared/config/env";
import { runDemoSeed } from "@/modules/demo/application/demo-seed";

/**
 * Loads the demo dataset on hosted platforms without shell access (Dokploy,
 * App Platform…). Requires SEED_DEMO=true plus a SEED_TOKEN that the caller
 * sends in `X-Seed-Token`. Refuses to run twice; the demo Care Pass links are
 * returned once in the response and never stored in plaintext.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const e = env();
  const expected = e.SEED_TOKEN;
  const provided = req.headers.get("x-seed-token") ?? "";
  if (!e.SEED_DEMO || !expected) throw new AppError("FEATURE_DISABLED", "Demo seeding is disabled.");
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new AppError("ACCESS_DENIED", "Invalid seed token.");
  return runDemoSeed();
});
