import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/feature/page-header";
import { loadGuardianChild } from "../../_lib/load-child";
import { ShareWizard } from "./share-wizard";

export default async function NewSharePage({ params }: PageProps<"/app/children/[id]/share/new">) {
  const { id } = await params;
  const [{ child }, t] = await Promise.all([loadGuardianChild(id), getTranslations("sharing")]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("wizard.categoriesHint")} />
      <ShareWizard childId={id} childName={child.preferredName ?? child.firstName} />
    </div>
  );
}
