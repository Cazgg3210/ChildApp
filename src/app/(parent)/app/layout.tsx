import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/modules/identity/application/session";
import { notificationService } from "@/modules/notifications/application/notification.service";
import { institutionRepository } from "@/modules/institutions/infrastructure/institution.repository";

export default async function ParentLayout({ children }: LayoutProps<"/app">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");
  const [t, unread, memberships] = await Promise.all([
    getTranslations("nav"),
    notificationService.countUnread(user.id),
    institutionRepository.listMembershipsForUser(user.id),
  ]);

  const items: NavItem[] = [
    { href: "/app", label: t("dashboard"), icon: "home", exact: true },
    { href: "/app/children", label: t("children"), icon: "users" },
    { href: "/app/notifications", label: t("notifications"), icon: "bell" },
    { href: "/app/settings", label: t("settings"), icon: "user" },
  ];

  return (
    <AppShell
      user={user}
      items={items}
      area="parent"
      unread={unread}
      showInstitutionLink={memberships.length > 0}
      showAdminLink={user.isPlatformAdmin}
    >
      {children}
    </AppShell>
  );
}
