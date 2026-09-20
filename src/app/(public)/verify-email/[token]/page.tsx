import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AuthCard } from "@/components/layout/auth-card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { identityService } from "@/modules/identity/application/identity.service";
import { AppError } from "@/shared/errors/app-error";

export default async function VerifyEmailPage(props: PageProps<"/verify-email/[token]">) {
  const [{ token }, t] = await Promise.all([props.params, getTranslations("auth")]);
  let outcome: "success" | "invalid" | "expired" = "success";
  try {
    await identityService.verifyEmail(token);
  } catch (err) {
    outcome = AppError.is(err) && err.code === "TOKEN_EXPIRED" ? "expired" : "invalid";
  }

  return (
    <AuthCard title={t("verify.title")}>
      <Alert variant={outcome === "success" ? "default" : "destructive"}>
        <AlertTitle>{t(`verify.${outcome}`)}</AlertTitle>
      </Alert>
      <Button asChild className="mt-4 w-full" size="lg">
        <Link href={outcome === "success" ? "/app" : "/login"}>{t("verify.goToApp")}</Link>
      </Button>
    </AuthCard>
  );
}
