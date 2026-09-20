import "dotenv/config";
import { prisma } from "@/shared/db/prisma";
import { runDemoSeed } from "@/modules/demo/application/demo-seed";

async function main() {
  const result = await runDemoSeed();
  if (result.status === "skipped") {
    console.log(
      result.reason === "SEED_DEMO_DISABLED"
        ? "SEED_DEMO is not true — skipping demo seed."
        : "Demo data already present. Run `npm run db:reset` to recreate it.",
    );
    return;
  }
  console.log("\nDemo data ready.\n");
  for (const a of result.accounts) console.log(`${a.role.padEnd(18)} ${a.email}`);
  console.log(`Password (all):     ${result.password}`);
  console.log(`Kinder invite code: ${result.kinderInviteCode}`);
  console.log("\nCare Pass links (tokens are only printed here, never stored):");
  for (const l of result.carePassLinks) console.log(`  ${l.name}${l.pin ? ` (PIN ${l.pin})` : " (no PIN)"}: ${l.url}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
