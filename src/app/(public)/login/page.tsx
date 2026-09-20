import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { getCurrentUser } from "@/modules/identity/application/session";
import { env } from "@/shared/config/env";
import { LoginForm } from "./login-form";
import { DemoAccounts } from "./demo-accounts";

export default async function LoginPage(props: PageProps<"/login">) {
  const user = await getCurrentUser();
  if (user) redirect("/app");
  const [t, sp] = await Promise.all([getTranslations("auth"), props.searchParams]);
  const next = typeof sp.next === "string" ? sp.next : undefined;

  return (
    <AuthCard
      title={t("login.title")}
      description={t("login.subtitle")}
      footer={
        <>
          {t("login.noAccount")}{" "}
          <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("login.register")}
          </Link>
        </>
      }
    >
      {sp.reset === "1" && (
        <Alert className="mb-4">
          <AlertTitle>{t("login.resetDone")}</AlertTitle>
        </Alert>
      )}
      {sp.verified === "1" && (
        <Alert className="mb-4">
          <AlertTitle>{t("login.verified")}</AlertTitle>
        </Alert>
      )}
      <LoginForm next={next} />
      {env().SEED_DEMO && <DemoAccounts password={env().DEMO_PASSWORD} />}
    </AuthCard>
  );
}
