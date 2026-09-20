"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { loginAction } from "@/modules/identity/presentation/actions";
import { idle } from "@/shared/http/action-state";

export function LoginForm({ next }: { next?: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(loginAction, idle);

  return (
    <form action={action} className="space-y-4" noValidate>
      {next && <input type="hidden" name="next" value={next} />}
      <FormError state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        <FieldError state={state} name="email" />
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("fields.password")}</Label>
          <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
            {t("login.forgot")}
          </Link>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-11"
        />
        <FieldError state={state} name="password" />
      </div>
      <SubmitButton className="w-full">{t("login.submit")}</SubmitButton>
    </form>
  );
}
