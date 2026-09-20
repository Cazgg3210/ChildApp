import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/layout/logo";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/modules/identity/application/session";

export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const [t, user] = await Promise.all([getTranslations("auth"), getCurrentUser()]);
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Logo />
          <nav className="flex items-center gap-2" aria-label="Public">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            {user ? (
              <Button asChild size="sm">
                <Link href="/app">{t("verify.goToApp")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/login">{t("login.submit")}</Link>
                </Button>
                <Button asChild size="sm">
                  <Link href="/register">{t("register.submit")}</Link>
                </Button>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
