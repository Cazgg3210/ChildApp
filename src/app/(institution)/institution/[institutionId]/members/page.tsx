import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/feature/page-header";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { loadInstitution } from "../_lib/load-institution";
import { MembersPanel } from "./members-panel";

export default async function MembersPage({ params }: PageProps<"/institution/[institutionId]/members">) {
  const { institutionId } = await params;
  const { actor, user, role } = await loadInstitution(institutionId);
  const [t, members] = await Promise.all([
    getTranslations("institution.members"),
    institutionService.listMembers(actor, institutionId),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("title")} />
      <MembersPanel
        institutionId={institutionId}
        currentUserId={user.id}
        isAdmin={role === "ADMIN"}
        members={members.map((m) => ({
          userId: m.userId,
          name: m.user.name,
          email: m.user.email,
          role: m.role,
          title: m.title,
        }))}
      />
    </div>
  );
}
