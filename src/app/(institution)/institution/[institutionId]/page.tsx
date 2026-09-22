import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader, Stat, EmptyState } from "@/components/feature/page-header";
import { AuditRow } from "@/components/feature/audit-row";
import { CopyButton } from "@/components/feature/copy-button";
import { VerificationBadge } from "@/components/feature/verification-badge";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { loadInstitution } from "./_lib/load-institution";
import { ChildrenTable } from "./children/children-table";

export default async function InstitutionDashboardPage({ params }: PageProps<"/institution/[institutionId]">) {
  const { institutionId } = await params;
  const { actor, institution } = await loadInstitution(institutionId);
  const [t, locale, data] = await Promise.all([
    getTranslations("institution"),
    getLocale(),
    institutionService.dashboard(actor, institutionId),
  ]);
  const base = `/institution/${institutionId}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-3">
            {institution.name}
            <VerificationBadge status={institution.verificationStatus} />
          </span>
        }
        eyebrow={t(`create.types.${institution.type}`)}
        actions={
          institution.verificationStatus === "UNVERIFIED" ? (
            <Link href={`${base}/settings`} className="text-sm text-primary underline-offset-4 hover:underline">
              {t("verification.request")} →
            </Link>
          ) : undefined
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label={t("dashboard.children")} value={data.childrenCount} />
        <Stat
          label={t("dashboard.readyProfiles")}
          value={`${data.readyProfiles}/${data.childrenCount}`}
          hint={t("dashboard.readyHint")}
          tone={data.childrenCount > 0 && data.readyProfiles === data.childrenCount ? "success" : "default"}
        />
        <Stat
          label={t("dashboard.needsReview")}
          value={data.needsReview}
          hint={t("dashboard.needsReviewHint")}
          tone={data.needsReview > 0 ? "important" : "default"}
        />
        <Stat
          label={t("dashboard.criticalAlerts")}
          value={data.criticalAlerts}
          tone={data.criticalAlerts > 0 ? "critical" : "default"}
        />
        <Stat
          label={t("dashboard.pendingAcks")}
          value={data.pendingAcks}
          tone={data.pendingAcks > 0 ? "important" : "success"}
        />
        <Stat
          label={t("dashboard.expiringConsents")}
          value={data.expiringConsents}
          hint={t("dashboard.expiringHint")}
          tone={data.expiringConsents > 0 ? "important" : "default"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.inviteCode")}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-mono text-2xl font-semibold tracking-wider">{institution.inviteCode}</p>
            <p className="text-sm text-muted-foreground">{t("dashboard.inviteCodeHint")}</p>
          </div>
          <CopyButton value={institution.inviteCode} />
        </CardContent>
      </Card>

      {data.children.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("dashboard.emptyTitle")}
          body={t("dashboard.emptyBody", { code: institution.inviteCode })}
        />
      ) : (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">{t("children.title")}</h2>
            <Link href={`${base}/children`} className="text-sm text-primary underline-offset-4 hover:underline">
              {t("children.title")} →
            </Link>
          </div>
          <ChildrenTable institutionId={institutionId} rows={data.children.slice(0, 8)} locale={locale} />
        </section>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("dashboard.recent")}</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentAudit.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="divide-y">
              {data.recentAudit.map((e) => (
                <AuditRow key={e.id} event={e} locale={locale} showCategories={false} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
