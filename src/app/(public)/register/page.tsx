import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { getCurrentUser } from "@/modules/identity/application/session";
import { RegisterForm } from "./register-form";

export default async function RegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect("/app");
  const [t, locale] = await Promise.all([getTranslations("auth"), getLocale()]);

  return (
    <AuthCard
      title={t("register.title")}
      description={t("register.subtitle")}
      footer={
        <>
          {t("register.hasAccount")}{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            {t("register.login")}
          </Link>
        </>
      }
    >
      <RegisterForm locale={locale} />
    </AuthCard>
  );
}
