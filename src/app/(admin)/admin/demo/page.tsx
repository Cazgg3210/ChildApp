import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/feature/page-header";
import { platformAdminService } from "@/modules/platform/application/platform-admin.service";
import { loadAdmin } from "../_lib/load-admin";
import { DemoControls } from "./demo-controls";

export default async function AdminDemoPage() {
  const { actor, user } = await loadAdmin();
  const [t, td, status] = await Promise.all([
    getTranslations("admin.demo"),
    getTranslations("auth.demo"),
    platformAdminService.demoStatus(actor),
  ]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("status")}
            <Badge variant={status.seeded ? "default" : "secondary"}>{status.seeded ? t("seeded") : t("notSeeded")}</Badge>
            {!status.enabled && <Badge variant="outline">{t("disabled")}</Badge>}
          </CardTitle>
          <CardDescription>
            {status.enabled ? t("enabledHint") : t("disabledHint")} {t("counts", { users: status.demoUsers, children: status.demoChildren })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="grid gap-1 text-sm sm:grid-cols-2">
            {status.accounts.map((a) => (
              <li key={a.email} className="flex flex-col rounded-xl border p-2">
                <span className="font-medium">{td(a.labelKey)}</span>
                <code className="text-xs text-muted-foreground">{a.email}</code>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted-foreground">{td("hint", { password: status.password })}</p>
          <DemoControls enabled={status.enabled} seeded={status.seeded} isDemoUser={user.isDemo} />
        </CardContent>
      </Card>
    </div>
  );
}
