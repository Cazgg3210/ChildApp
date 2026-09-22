import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { notificationService } from "@/modules/notifications/application/notification.service";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { isFeatureEnabled } from "@/shared/config/feature-flags";
import { loadInstitution } from "./_lib/load-institution";

export default async function InstitutionLayout({ children, params }: LayoutProps<"/institution/[institutionId]">) {
  if (!isFeatureEnabled("INSTITUTION_PORTAL")) redirect("/app");
  const { institutionId } = await params;
  const { user, actor, institution, role } = await loadInstitution(institutionId);
  const [t, tn, unread, pending] = await Promise.all([
    getTranslations("institution"),
    getTranslations("nav"),
    notificationService.countUnread(user.id),
    role === "ADMIN"
      ? institutionService.listPendingRequests(actor, institutionId).then((r) => r.length)
      : Promise.resolve(0),
  ]);
  const base = `/institution/${institutionId}`;
  const items: NavItem[] = [
    { href: base, label: tn("dashboard"), icon: "home", exact: true },
    { href: `${base}/children`, label: t("children.title"), icon: "users" },
    { href: `${base}/requests`, label: t("requests.title"), icon: "inbox", badge: pending },
    { href: `${base}/alerts`, label: t("alerts.title"), icon: "alert" },
    { href: `${base}/proposals`, label: t("proposals.title"), icon: "proposals" },
    { href: `${base}/groups`, label: t("groups.title"), icon: "door" },
    { href: `${base}/members`, label: t("members.title"), icon: "building" },
    { href: `${base}/settings`, label: t("settings.title"), icon: "settings" },
  ];
  return (
    <AppShell user={user} items={items} area="institution" unread={unread} showParentLink subtitle={institution.name}>
      {children}
    </AppShell>
  );
}
