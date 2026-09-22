import { getTranslations } from "next-intl/server";
import { MailWarning } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/feature/page-header";
import { resendVerificationAction } from "@/modules/identity/presentation/account-actions";
import { env } from "@/shared/config/env";
import { loadGuardianChild } from "../../_lib/load-child";
import { ShareWizard } from "./share-wizard";

export default async function NewSharePage({ params }: PageProps<"/app/children/[id]/share/new">) {
  const { id } = await params;
  const [{ child, user }, t] = await Promise.all([loadGuardianChild(id), getTranslations("sharing")]);
  const blocked = env().REQUIRE_EMAIL_VERIFICATION && !user.emailVerifiedAt;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("wizard.categoriesHint")} />
      {blocked ? (
        <Alert>
          <MailWarning />
          <AlertTitle>{t("verifyFirstTitle")}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{t("verifyFirstBody", { email: user.email })}</p>
            <form action={resendVerificationAction}>
              <Button type="submit" size="sm" variant="outline">
                {t("verifyFirstResend")}
              </Button>
            </form>
          </AlertDescription>
        </Alert>
      ) : (
        <ShareWizard childId={id} childName={child.preferredName ?? child.firstName} />
      )}
    </div>
  );
}
