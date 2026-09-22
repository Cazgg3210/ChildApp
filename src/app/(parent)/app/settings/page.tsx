import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/feature/page-header";
import { requireUser } from "@/modules/identity/application/session";
import { SettingsForm } from "./settings-form";
import { resendVerificationAction } from "@/modules/identity/presentation/account-actions";
import { accountService } from "@/modules/identity/application/account.service";
import { DeleteAccountButton } from "./delete-account";

export default async function SettingsPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("settings")]);
  const { soleAdminOf } = await accountService.deletionBlockers(user.id);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("title")} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("profile")}</CardTitle>
          <CardDescription className="flex items-center gap-2">
            {user.email}
            {user.emailVerifiedAt ? (
              <Badge variant="secondary">{t("emailVerified")}</Badge>
            ) : (
              <Badge variant="outline">{t("emailUnverified")}</Badge>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SettingsForm defaults={{ name: user.name, locale: user.locale, timezone: user.timezone }} />
          {!user.emailVerifiedAt && (
            <form action={resendVerificationAction}>
              <Button type="submit" variant="outline" size="sm">
                {t("resendVerification")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("data")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{t("export")}</p>
              <p className="text-muted-foreground">{t("exportHint")}</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <a href="/api/v1/me/export" download>
                {t("export")}
              </a>
            </Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{t("deleteAccount")}</p>
              <p className="text-muted-foreground">{t("deleteHint")}</p>
            </div>
            <DeleteAccountButton soleAdminOf={soleAdminOf.map((i) => i.name)} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
