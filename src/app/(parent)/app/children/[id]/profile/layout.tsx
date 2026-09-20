import { getTranslations } from "next-intl/server";
import { SECTION_GROUPS } from "@/modules/profiles/domain/catalog";
import { ChildTabs } from "../child-tabs";

export default async function ProfileLayout({ children, params }: LayoutProps<"/app/children/[id]/profile">) {
  const { id } = await params;
  const t = await getTranslations("profile.groups");
  const base = `/app/children/${id}/profile`;
  const tabs = [
    { href: `${base}/identity`, label: t("identity") },
    ...Object.keys(SECTION_GROUPS).map((group) => ({ href: `${base}/${group}`, label: t(group) })),
  ];
  return (
    <div>
      <ChildTabs tabs={tabs} size="sm" />
      <div className="mt-5">{children}</div>
    </div>
  );
}
