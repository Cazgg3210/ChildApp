import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/layout/app-shell";
import { AuthCard } from "@/components/layout/auth-card";
import { requireUser } from "@/modules/identity/application/session";
import { CreateInstitutionForm } from "./create-form";

export default async function NewInstitutionPage() {
  const [user, t] = await Promise.all([requireUser(), getTranslations("institution.create")]);
  return (
    <AppShell user={user} items={[]} area="institution" showParentLink>
      <AuthCard title={t("title")} description={t("subtitle")}>
        <CreateInstitutionForm />
      </AuthCard>
    </AppShell>
  );
}
