/**
 * Hard-deletes accounts whose deletion was requested more than
 * DELETION_GRACE_DAYS ago (docs/12-privacy-by-design.md). Run from cron:
 *   npx tsx scripts/purge-deleted-accounts.ts
 *
 * Children retired with the account are purged when no other guardian remains.
 * An anonymized user row is kept (not deleted) while other families' records
 * still reference it — e.g. a co-guardian who granted a share on a child that
 * is still active — because those references belong to someone else's history.
 */
import { subDays } from "date-fns";
import { prisma } from "@/shared/db/prisma";
import { DELETION_GRACE_DAYS } from "@/modules/identity/application/account.service";

async function main() {
  const cutoff = subDays(new Date(), DELETION_GRACE_DAYS);
  const users = await prisma.user.findMany({
    where: { deletedAt: { not: null, lte: cutoff } },
    select: { id: true, createdChildren: { select: { id: true, deletedAt: true, guardians: { select: { id: true } } } } },
  });
  let purgedUsers = 0;
  let purgedChildren = 0;
  let kept = 0;
  for (const user of users) {
    for (const child of user.createdChildren) {
      if (child.deletedAt && child.guardians.length === 0) {
        await prisma.child.delete({ where: { id: child.id } });
        purgedChildren += 1;
      }
    }
    try {
      await prisma.user.delete({ where: { id: user.id } });
      purgedUsers += 1;
    } catch {
      // Still referenced by records that belong to other people; stays anonymized.
      kept += 1;
    }
  }
  console.log(
    `Purged ${purgedUsers} account(s) and ${purgedChildren} child profile(s); kept ${kept} anonymized account(s) still referenced by others.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
