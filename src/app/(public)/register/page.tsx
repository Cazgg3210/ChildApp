import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { getCurrentUser } from "@/modules/identity/application/session";
import { RegisterForm } from "./register-form";

export default async function RegisterPage(props: PageProps<"/register">) {
  const [user, sp] = await Promise.all([getCurrentUser(), props.searchParams]);
  const intent = sp.intent === "institution" ? "institution" : "family";
  if (user) redirect(intent === "institution" ? "/institution/new" : "/app");
  const [t, locale] = await Promise.all([getTranslations("auth"), getLocale()]);

  return (
    <AuthCard
      title={intent === "institution" ? t("register.institutionTitle") : t("register.title")}
      description={intent === "institution" ? t("register.institutionSubtitle") : t("register.subtitle")}
      footer={
        <>
          {t("register.hasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("register.login")}
          </Link>
        </>
      }
    >
      <RegisterForm locale={locale} intent={intent} />
    </AuthCard>
  );
}
