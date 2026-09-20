import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { ForgotForm } from "./forgot-form";

export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth");
  return (
    <AuthCard
      title={t("forgot.title")}
      description={t("forgot.subtitle")}
      footer={
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          {t("forgot.backToLogin")}
        </Link>
      }
    >
      <ForgotForm />
    </AuthCard>
  );
}
