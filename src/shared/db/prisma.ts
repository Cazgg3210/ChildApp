import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/shared/config/env";

declare global {
  var __ccpPrisma: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env().DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: env().NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

/** Singleton Prisma client (survives HMR in development). */
export const prisma: PrismaClient = globalThis.__ccpPrisma ?? createClient();

if (env().NODE_ENV !== "production") {
  globalThis.__ccpPrisma = prisma;
}

export type { PrismaClient };
/** Transaction client type, for services that compose repository calls atomically. */
export type Tx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];
