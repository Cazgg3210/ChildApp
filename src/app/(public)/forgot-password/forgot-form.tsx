"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { forgotPasswordAction } from "@/modules/identity/presentation/actions";
import { type ActionState } from "@/shared/http/action-state";

const initial: ActionState = { ok: false, code: "VALIDATION_ERROR", message: "" };

export function ForgotForm() {
  const t = useTranslations("auth");
  const [state, action] = useActionState(forgotPasswordAction, initial);
  const sent = state.ok;

  if (sent) {
    return (
      <Alert>
        <AlertTitle>{t("forgot.sent")}</AlertTitle>
      </Alert>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.message && <FormError state={state} />}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        <FieldError state={state} name="email" />
      </div>
      <SubmitButton className="w-full">{t("forgot.submit")}</SubmitButton>
    </form>
  );
}
