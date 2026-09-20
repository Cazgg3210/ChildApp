import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { ResetForm } from "./reset-form";

export default async function ResetPasswordPage(props: PageProps<"/reset-password/[token]">) {
  const [{ token }, t] = await Promise.all([props.params, getTranslations("auth")]);
  return (
    <AuthCard title={t("reset.title")} description={t("reset.subtitle")}>
      <ResetForm token={token} />
    </AuthCard>
  );
}
