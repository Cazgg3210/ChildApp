"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Play } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/feature/form-feedback";
import { startSessionAction } from "@/modules/care/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

export function StartSessionForm({
  token,
  childName,
  defaultName,
}: {
  token: string;
  childName: string;
  defaultName: string;
}) {
  const t = useTranslations("care.session");
  const [state, action] = useActionState(
    async (prev: ActionState, form: FormData) => startSessionAction(token, prev, form),
    idle,
  );
  return (
    <form action={action} className="space-y-4 rounded-2xl border bg-card p-4" noValidate>
      <div>
        <h2 className="text-lg font-semibold">{t("startTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("startBody", { name: childName })}</p>
      </div>
      <FormError state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="cg-name">{t("caregiverName")}</Label>
        <Input
          id="cg-name"
          name="name"
          defaultValue={defaultName}
          required
          minLength={2}
          className="h-12"
          autoComplete="name"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cg-end">{t("expectedEndLabel")}</Label>
        <Input id="cg-end" name="expectedEndAt" type="datetime-local" className="h-12" />
      </div>
      <SubmitButton className="h-12 w-full text-base">
        <Play aria-hidden /> {t("startButton")}
      </SubmitButton>
    </form>
  );
}
