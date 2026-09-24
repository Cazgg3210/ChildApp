import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/feature/page-header";
import { platformAdminService } from "@/modules/platform/application/platform-admin.service";
import { loadAdmin } from "../_lib/load-admin";
import { FeaturesForm, SecurityForm } from "./settings-form";

export default async function AdminSettingsPage() {
  await loadAdmin();
  const [t, s] = await Promise.all([getTranslations("admin.settings"), platformAdminService.settingsSummary()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("security")}
            <Badge variant={s.security.source === "database" ? "default" : "secondary"}>{t(`source.${s.security.source}`)}</Badge>
          </CardTitle>
          <CardDescription>{t("securityHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <SecurityForm defaults={s.security.value} source={s.security.source} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("features")}
            <Badge variant={s.features.source === "database" ? "default" : "secondary"}>{t(`source.${s.features.source}`)}</Badge>
          </CardTitle>
          <CardDescription>{t("featuresHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <FeaturesForm defaults={s.features.value} source={s.features.source} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("envAdmins")}</CardTitle>
          <CardDescription>{t("envAdminsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          {s.adminEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <ul className="space-y-1 font-mono text-sm">
              {s.adminEmails.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
