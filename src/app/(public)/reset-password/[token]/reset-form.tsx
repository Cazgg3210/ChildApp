"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { resetPasswordAction } from "@/modules/identity/presentation/actions";
import { idle } from "@/shared/http/action-state";

export function ResetForm({ token }: { token: string }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(resetPasswordAction, idle);
  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <FormError state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("fields.newPassword")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="h-11"
        />
        <p className="text-xs text-muted-foreground">{t("fields.passwordHint")}</p>
        <FieldError state={state} name="password" />
      </div>
      <SubmitButton className="w-full">{t("reset.submit")}</SubmitButton>
    </form>
  );
}
