"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError, SubmitButton } from "@/components/feature/form-feedback";
import { acknowledgeAction } from "@/modules/care/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

export function AcknowledgeForm({
  token,
  childName,
  defaultName,
}: {
  token: string;
  childName: string;
  defaultName: string;
}) {
  const t = useTranslations("care.pass");
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await acknowledgeAction(token, prev, form);
    if (res.ok) toast.success(t("acknowledged"));
    return res;
  }, idle);

  return (
    <form action={action} className="space-y-3" noValidate>
      <p className="font-semibold">{t("acknowledge", { name: childName })}</p>
      <p className="text-sm text-muted-foreground">{t("acknowledgeHint")}</p>
      <FormError state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="ack-name">{t("acknowledgeName")}</Label>
        <Input
          id="ack-name"
          name="name"
          defaultValue={defaultName}
          required
          minLength={2}
          className="h-12"
          autoComplete="name"
        />
      </div>
      <SubmitButton className="h-12 w-full text-base">
        <ClipboardCheck aria-hidden /> {t("acknowledge", { name: childName })}
      </SubmitButton>
    </form>
  );
}
