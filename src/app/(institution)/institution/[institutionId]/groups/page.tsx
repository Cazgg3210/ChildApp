import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/feature/page-header";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { loadInstitution } from "../_lib/load-institution";
import { GroupsPanel } from "./groups-panel";

/** Rooms / classes: which team members see which children. */
export default async function GroupsPage({ params }: PageProps<"/institution/[institutionId]/groups">) {
  const { institutionId } = await params;
  const { actor, role } = await loadInstitution(institutionId);
  const [t, groups, members, children] = await Promise.all([
    getTranslations("institution.groups"),
    institutionService.listGroups(actor, institutionId),
    institutionService.listMembers(actor, institutionId),
    institutionService.listChildren(actor, institutionId),
  ]);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("title")} description={t("subtitle")} />
      <GroupsPanel
        institutionId={institutionId}
        isAdmin={role === "ADMIN"}
        groups={groups.map((g) => ({
          id: g.id,
          name: g.name,
          memberIds: g.members.map((m) => m.memberId),
          relationIds: g.children.map((c) => c.childInstitutionId),
        }))}
        members={members.map((m) => ({ id: m.id, name: m.user.name, role: m.role, title: m.title }))}
        pupils={children.map((c) => ({
          relationId: c.relation.id,
          name: `${c.child.firstName} ${c.child.lastName}`,
        }))}
      />
    </div>
  );
}
