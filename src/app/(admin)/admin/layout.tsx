import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell, type NavItem } from "@/components/layout/app-shell";
import { getCurrentUser } from "@/modules/identity/application/session";
import { notificationService } from "@/modules/notifications/application/notification.service";

/** Platform administration. Non-admins get a 404 so the area's existence is not revealed. */
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/admin");
  if (!user.isPlatformAdmin) notFound();
  const [t, unread] = await Promise.all([getTranslations("admin.nav"), notificationService.countUnread(user.id)]);
  const items: NavItem[] = [
    { href: "/admin", label: t("overview"), icon: "home", exact: true },
    { href: "/admin/institutions", label: t("institutions"), icon: "building" },
    { href: "/admin/users", label: t("users"), icon: "users" },
    { href: "/admin/audit", label: t("audit"), icon: "audit" },
    { href: "/admin/mail", label: t("mail"), icon: "mail" },
    { href: "/admin/settings", label: t("settings"), icon: "settings" },
    { href: "/admin/demo", label: t("demo"), icon: "demo" },
  ];
  return (
    <AppShell user={user} items={items} area="admin" unread={unread} showParentLink subtitle={t("subtitle")}>
      {children}
    </AppShell>
  );
}
