import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2, LogOut, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { logoutAction } from "@/modules/identity/presentation/actions";
import type { CurrentUser } from "@/modules/identity/domain/types";
import { ShellNav, type NavItem } from "./shell-nav";

export type { NavItem };

export async function AppShell({
  user,
  items,
  children,
  area,
  unread = 0,
  showInstitutionLink = false,
  showParentLink = false,
  showAdminLink = false,
  subtitle,
}: {
  user: CurrentUser;
  items: NavItem[];
  children: React.ReactNode;
  area: "parent" | "institution" | "admin";
  unread?: number;
  showInstitutionLink?: boolean;
  showParentLink?: boolean;
  showAdminLink?: boolean;
  subtitle?: string;
}) {
  const t = await getTranslations();
  const home = area === "parent" ? "/app" : area === "institution" ? "/institution" : "/admin";
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-sidebar md:flex">
        <div className="flex h-14 items-center px-5">
          <Logo href={home} />
        </div>
        {subtitle && (
          <div className="px-5 pb-2">
            <Badge variant="secondary" className="max-w-full truncate">
              {subtitle}
            </Badge>
          </div>
        )}
        <ShellNav items={items} unread={unread} orientation="vertical" />
        <div className="mt-auto space-y-2 border-t p-4">
          {showInstitutionLink && (
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link href="/institution">
                <Building2 aria-hidden /> {t("nav.institution")}
              </Link>
            </Button>
          )}
          {showParentLink && (
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link href="/app">{t("nav.children")}</Link>
            </Button>
          )}
          {showAdminLink && (
            <Button asChild variant="outline" size="sm" className="w-full justify-start">
              <Link href="/admin">
                <ShieldCheck aria-hidden /> {t("nav.admin")}
              </Link>
            </Button>
          )}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label={t("common.logout")}>
                <LogOut aria-hidden />
              </Button>
            </form>
          </div>
          <LanguageSwitcher />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/85 px-4 backdrop-blur md:hidden">
          <Logo href={home} compact />
          <div className="flex items-center gap-1">
            {showInstitutionLink && (
              <Button asChild variant="ghost" size="icon" aria-label={t("nav.institution")}>
                <Link href="/institution">
                  <Building2 aria-hidden />
                </Link>
              </Button>
            )}
            {showParentLink && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/app">{t("nav.children")}</Link>
              </Button>
            )}
            {showAdminLink && (
              <Button asChild variant="ghost" size="icon" aria-label={t("nav.admin")}>
                <Link href="/admin">
                  <ShieldCheck aria-hidden />
                </Link>
              </Button>
            )}
            <LanguageSwitcher />
            <form action={logoutAction}>
              <Button type="submit" variant="ghost" size="icon" aria-label={t("common.logout")}>
                <LogOut aria-hidden />
              </Button>
            </form>
          </div>
        </header>
        <main className="flex-1 pb-24 md:pb-8">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">{children}</div>
        </main>
        <ShellNav items={items} unread={unread} orientation="horizontal" />
      </div>
    </div>
  );
}
