import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/feature/page-header";
import { platformSettingsService } from "@/modules/platform/application/platform-settings.service";
import { loadAdmin } from "../_lib/load-admin";
import { MailForm, TestMailForm } from "./mail-form";

export default async function AdminMailPage() {
  const { user } = await loadAdmin();
  const [t, mail] = await Promise.all([getTranslations("admin"), platformSettingsService.mail()]);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("mail.title")} description={t("mail.subtitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("mail.config")}
            <Badge variant={mail.source === "database" ? "default" : "secondary"}>{t(`settings.source.${mail.source}`)}</Badge>
          </CardTitle>
          <CardDescription>{t("mail.configHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <MailForm
            source={mail.source}
            hasPassword={Boolean(mail.value.passwordEnc)}
            defaults={{
              provider: mail.value.provider,
              host: mail.value.host,
              port: String(mail.value.port),
              secure: mail.value.secure,
              user: mail.value.user,
              from: mail.value.from,
            }}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("mail.test")}</CardTitle>
          <CardDescription>{t("mail.testHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <TestMailForm defaultTo={user.email} />
        </CardContent>
      </Card>
    </div>
  );
}
