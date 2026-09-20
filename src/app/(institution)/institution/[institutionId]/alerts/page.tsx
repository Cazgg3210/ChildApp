import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { StatusPill } from "@/components/feature/badges";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { formatRelative } from "@/shared/utils/dates";
import { loadInstitution } from "../_lib/load-institution";

export default async function AlertsPage({ params }: PageProps<"/institution/[institutionId]/alerts">) {
  const { institutionId } = await params;
  const { actor } = await loadInstitution(institutionId);
  const [t, locale, rows] = await Promise.all([
    getTranslations("institution.alerts"),
    getLocale(),
    institutionService.listChildren(actor, institutionId),
  ]);
  const alerts = rows.filter((r) => r.criticalCount > 0 || !r.acknowledgedCurrent || r.expiringSoon);
  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {alerts.length === 0 ? (
        <EmptyState icon={ShieldAlert} title={t("empty")} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {alerts.map((r) => (
            <li key={r.child.id}>
              <Link
                href={`/institution/${institutionId}/children/${r.child.id}`}
                className="flex gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-muted/40"
              >
                <ChildAvatar name={`${r.child.firstName} ${r.child.lastName}`} seed={r.child.id} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {r.child.firstName} {r.child.lastName}
                  </p>
                  {r.criticalAllergies.length > 0 && (
                    <p className="mt-1 flex items-center gap-1 text-sm text-critical">
                      <AlertTriangle className="size-3.5" aria-hidden />{" "}
                      {r.criticalAllergies.map((a) => a.label).join(", ")}
                    </p>
                  )}
                  <p className="mt-2 flex flex-wrap gap-1">
                    {r.criticalCount > 0 && <StatusPill tone="critical">{r.criticalCount} CRITICAL</StatusPill>}
                    {!r.acknowledgedCurrent && <StatusPill tone="pending">{t("pendingAck")}</StatusPill>}
                    {r.expiringSoon && r.grant.expiresAt && (
                      <StatusPill tone="inactive">
                        {t("expiringSoon", { when: formatRelative(r.grant.expiresAt, locale) })}
                      </StatusPill>
                    )}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
