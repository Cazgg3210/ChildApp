import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AlertTriangle } from "lucide-react";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { StatusPill } from "@/components/feature/badges";
import { ageFromBirthDate, formatDate, formatRelative } from "@/shared/utils/dates";
import type { institutionService } from "@/modules/institutions/application/institution.service";

export type InstitutionChildRow = Awaited<ReturnType<typeof institutionService.listChildren>>[number];

/** Desktop/tablet-first table of shared children (cards on phones). */
export async function ChildrenTable({
  institutionId,
  rows,
  locale,
}: {
  institutionId: string;
  rows: InstitutionChildRow[];
  locale: string;
}) {
  const [t, tc] = await Promise.all([getTranslations("institution.children"), getTranslations("common")]);
  if (rows.length === 0)
    return (
      <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
    );
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <thead className="hidden bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground md:table-header-group">
          <tr>
            <th className="px-4 py-2 font-medium">{t("columns.child")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.age")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.critical")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.updated")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.consent")}</th>
            <th className="px-4 py-2 font-medium">{t("columns.ack")}</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => {
            const age = ageFromBirthDate(row.child.dateOfBirth);
            const name = `${row.child.firstName} ${row.child.lastName}`;
            return (
              <tr
                key={row.child.id}
                className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 hover:bg-muted/40 md:table-row md:gap-0 md:px-0 md:py-0"
              >
                <td className="col-span-2 md:px-4 md:py-3">
                  <Link
                    href={`/institution/${institutionId}/children/${row.child.id}`}
                    className="flex items-center gap-3 font-medium hover:underline"
                  >
                    <ChildAvatar name={name} seed={row.child.id} size="sm" />
                    {name}
                  </Link>
                </td>
                <td className="text-muted-foreground md:px-4 md:py-3">
                  {age.years >= 2
                    ? tc("years", { count: age.years })
                    : tc("ageYearsMonths", { years: age.years, months: age.months })}
                </td>
                <td className="md:px-4 md:py-3">
                  {row.criticalAllergies.length > 0 ? (
                    <span className="inline-flex flex-wrap items-center gap-1 text-critical">
                      <AlertTriangle className="size-3.5" aria-hidden />
                      {row.criticalAllergies.map((a) => a.label).join(", ")}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="text-muted-foreground md:px-4 md:py-3">{formatRelative(row.lastUpdated, locale)}</td>
                <td className="md:px-4 md:py-3">
                  <StatusPill tone={row.effectiveStatus === "ACTIVE" ? "active" : "inactive"}>
                    {row.grant.expiresAt
                      ? t("consentUntil", { when: formatDate(row.grant.expiresAt, locale, "PP") })
                      : t("consentNoExpiry")}
                  </StatusPill>
                </td>
                <td className="md:px-4 md:py-3">
                  <StatusPill tone={row.acknowledgedCurrent ? "active" : "pending"}>
                    {row.acknowledgedCurrent ? t("ackDone") : t("ackPending")}
                  </StatusPill>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
