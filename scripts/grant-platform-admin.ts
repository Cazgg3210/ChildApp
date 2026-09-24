/**
 * Grants (or revokes) the platform administrator role to an existing account:
 *   npx tsx scripts/grant-platform-admin.ts luis@example.com
 *   npx tsx scripts/grant-platform-admin.ts luis@example.com --revoke
 * Alternative without touching the database: PLATFORM_ADMIN_EMAILS env var.
 */
import "dotenv/config";
import { prisma } from "@/shared/db/prisma";

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email) throw new Error("Usage: grant-platform-admin.ts <email> [--revoke]");
  const role = flag === "--revoke" ? "NONE" : "PLATFORM_ADMIN";
  const user = await prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
  if (!user) throw new Error(`No account with email ${email}. Register first, then run this script.`);
  await prisma.user.update({ where: { id: user.id }, data: { platformRole: role } });
  console.log(`${user.email}: platformRole = ${role}`);
}

main()
  .catch((err) => {
    console.error(err.message ?? err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
