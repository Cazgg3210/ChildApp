import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/feature/page-header";
import { VerificationBadge } from "@/components/feature/verification-badge";
import { loadInstitution } from "../_lib/load-institution";
import { InstitutionSettingsForm, RequestVerificationButton } from "./settings-form";

export default async function InstitutionSettingsPage({ params }: PageProps<"/institution/[institutionId]/settings">) {
  const { institutionId } = await params;
  const { institution, role } = await loadInstitution(institutionId);
  const t = await getTranslations("institution");
  const isAdmin = role === "ADMIN";
  const canRequest =
    isAdmin &&
    institution.verificationStatus === "UNVERIFIED" &&
    Boolean(institution.legalName && institution.contactName && institution.phone);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title={t("settings.title")} description={t("settings.subtitle")} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            {t("verification.title")} <VerificationBadge status={institution.verificationStatus} />
          </CardTitle>
          <CardDescription>{t(`verification.explain.${institution.verificationStatus}`)}</CardDescription>
        </CardHeader>
        {isAdmin && institution.verificationStatus === "UNVERIFIED" && (
          <CardContent>
            <RequestVerificationButton institutionId={institutionId} disabled={!canRequest} />
            {!canRequest && <p className="mt-2 text-xs text-muted-foreground">{t("verification.requirements")}</p>}
          </CardContent>
        )}
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.details")}</CardTitle>
          <CardDescription>{t("settings.detailsHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <InstitutionSettingsForm
            institutionId={institutionId}
            readOnly={!isAdmin}
            defaults={{
              name: institution.name,
              legalName: institution.legalName ?? "",
              contactName: institution.contactName ?? "",
              phone: institution.phone ?? "",
              address: institution.address ?? "",
              website: institution.website ?? "",
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
