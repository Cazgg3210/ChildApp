import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/layout/app-shell";
import { EmptyState } from "@/components/feature/page-header";
import { requireUser } from "@/modules/identity/application/session";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { isFeatureEnabled } from "@/shared/config/feature-flags";

/** Entry point: go to the first institution the user belongs to, or offer to create one. */
export default async function InstitutionIndexPage() {
  if (!isFeatureEnabled("INSTITUTION_PORTAL")) redirect("/app");
  const user = await requireUser();
  const memberships = await institutionService.listForUser(user.id);
  if (memberships.length > 0) redirect(`/institution/${memberships[0].institutionId}`);
  const t = await getTranslations("institution");
  return (
    <AppShell user={user} items={[]} area="institution" showParentLink>
      <EmptyState
        icon={Building2}
        title={t("none.title")}
        body={t("none.body")}
        action={
          <Button asChild size="lg">
            <Link href="/institution/new">
              <Plus aria-hidden /> {t("create.title")}
            </Link>
          </Button>
        }
      />
    </AppShell>
  );
}
