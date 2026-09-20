// Local development reads .env; in containers the variables come from the environment.
try {
  process.loadEnvFile?.();
} catch {
  /* no .env file */
}
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
