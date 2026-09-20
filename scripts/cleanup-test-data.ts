import "dotenv/config";
import { prisma } from "@/shared/db/prisma";

/** Removes artifacts left by local E2E/smoke runs. Demo seed data is untouched. */
async function main() {
  const testUsers = await prisma.user.findMany({
    where: { OR: [{ email: { endsWith: "@e2e.local" } }, { email: { endsWith: "@test.local" } }, { email: "smoke@example.com" }] },
    select: { id: true },
  });
  const ids = testUsers.map((u) => u.id);
  const demoParent = await prisma.user.findUnique({ where: { email: "parent@example.com" }, select: { id: true } });
  const strayChildren = demoParent
    ? await prisma.child.findMany({ where: { createdById: demoParent.id, firstName: { startsWith: "Emma" } }, select: { id: true } })
    : [];
  await prisma.child.deleteMany({ where: { OR: [{ createdById: { in: ids } }, { id: { in: strayChildren.map((c) => c.id) } }] } });
  await prisma.institution.deleteMany({ where: { createdById: { in: ids } } });
  await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  console.log(`removed ${ids.length} test users and ${strayChildren.length} stray children`);
}

main().finally(() => prisma.$disconnect());
