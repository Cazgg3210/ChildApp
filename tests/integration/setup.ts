import "dotenv/config";
import { afterAll } from "vitest";
import { prisma } from "@/shared/db/prisma";

/** Integration tests hit the real PostgreSQL from DATABASE_URL and clean up what they create. */
export const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdUserIds.length) {
    await prisma.child.deleteMany({ where: { createdById: { in: createdUserIds } } });
    await prisma.institution.deleteMany({ where: { createdById: { in: createdUserIds } } });
    await prisma.auditEvent.deleteMany({ where: { actorUserId: { in: createdUserIds } } });
    await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  }
  await prisma.$disconnect();
});
