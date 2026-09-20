import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/feature/page-header";
import { requireUser } from "@/modules/identity/application/session";
import { CreateChildWizard } from "./wizard";

export default async function NewChildPage() {
  await requireUser();
  const t = await getTranslations("children.create");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} />
      <CreateChildWizard />
    </div>
  );
}
