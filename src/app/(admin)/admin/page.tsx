import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader, Stat } from "@/components/feature/page-header";
import { AuditRow } from "@/components/feature/audit-row";
import { VerificationBadge } from "@/components/feature/verification-badge";
import { platformAdminService } from "@/modules/platform/application/platform-admin.service";
import { loadAdmin } from "./_lib/load-admin";
import { InstitutionVerificationActions } from "./institutions/institution-actions";

export default async function AdminOverviewPage() {
  const { actor } = await loadAdmin();
  const [t, tv, locale, data] = await Promise.all([
    getTranslations("admin"),
    getTranslations("institution.verification.status"),
    getLocale(),
    platformAdminService.overview(actor),
  ]);
  const s = data.settings;
  const sourceLabel = (src: "database" | "environment") => t(`settings.source.${src}`);

  return (
    <div className="space-y-8">
      <PageHeader title={t("overview.title")} description={t("overview.subtitle")} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={t("overview.users")} value={data.users} hint={t("overview.usersWeek", { count: data.usersWeek })} />
        <Stat label={t("overview.children")} value={data.children} />
        <Stat
          label={t("overview.institutions")}
          value={data.institutions}
          hint={`${tv("VERIFIED")}: ${data.institutionsByStatus.VERIFIED ?? 0} · ${tv("VERIFICATION_PENDING")}: ${data.institutionsByStatus.VERIFICATION_PENDING ?? 0}`}
        />
        <Stat label={t("overview.activeGrants")} value={data.activeGrants} hint={t("overview.activeLinks", { count: data.activeLinks })} />
        <Stat label={t("overview.sessionsWeek")} value={data.sessionsWeek} />
        <Stat
          label={t("overview.pendingVerification")}
          value={data.pendingVerification.length}
          tone={data.pendingVerification.length > 0 ? "important" : "default"}
        />
        <Stat
          label={t("nav.mail")}
          value={s.mail.value.provider === "smtp" ? "SMTP" : t("mail.console")}
          hint={sourceLabel(s.mail.source)}
          tone={s.mail.value.provider === "smtp" ? "success" : "important"}
        />
        <Stat
          label={t("settings.requireEmailVerification")}
          value={s.security.value.requireEmailVerification ? t("common.on") : t("common.off")}
          hint={sourceLabel(s.security.source)}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("overview.pendingVerification")}</CardTitle>
          <Button asChild variant="link" className="px-0">
            <Link href="/admin/institutions?status=VERIFICATION_PENDING">{t("common.viewAll")} →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.pendingVerification.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("overview.noPending")}</p>
          ) : (
            <ul className="divide-y">
              {data.pendingVerification.map((i) => (
                <li key={i.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {i.name} <VerificationBadge status={i.verificationStatus} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {i.legalName ?? "—"} · {i.contactName ?? "—"} · {i.phone ?? "—"} · {i._count.members}{" "}
                      {t("institutions.members")} · {i._count.children} {t("institutions.children")}
                    </p>
                  </div>
                  <InstitutionVerificationActions institutionId={i.id} status={i.verificationStatus} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">{t("overview.recentAudit")}</CardTitle>
          <Button asChild variant="link" className="px-0">
            <Link href="/admin/audit">{t("common.viewAll")} →</Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {data.recentAudit.map((e) => (
              <AuditRow key={e.id} event={e} locale={locale} showCategories={false} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
