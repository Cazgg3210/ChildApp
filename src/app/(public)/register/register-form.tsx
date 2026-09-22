"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { registerAction } from "@/modules/identity/presentation/actions";
import { idle } from "@/shared/http/action-state";

export function RegisterForm({ locale, intent }: { locale: string; intent: "family" | "institution" }) {
  const t = useTranslations("auth");
  const [state, action] = useActionState(registerAction, idle);

  return (
    <form action={action} className="space-y-4" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="intent" value={intent} />
      <FormError state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("fields.name")}</Label>
        <Input id="name" name="name" autoComplete="name" required className="h-11" />
        <FieldError state={state} name="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="email">{t("fields.email")}</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11" />
        <FieldError state={state} name="email" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">{t("fields.password")}</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={10}
          className="h-11"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="text-xs text-muted-foreground">
          {t("fields.passwordHint")}
        </p>
        <FieldError state={state} name="password" />
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("register.consent")}</p>
      <SubmitButton className="w-full">{t("register.submit")}</SubmitButton>
    </form>
  );
}
