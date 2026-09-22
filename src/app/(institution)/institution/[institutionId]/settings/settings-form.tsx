"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { requestVerificationAction, updateInstitutionAction } from "@/modules/institutions/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

const FIELDS = ["name", "legalName", "contactName", "phone", "address", "website"] as const;

export function InstitutionSettingsForm({
  institutionId,
  defaults,
  readOnly,
}: {
  institutionId: string;
  defaults: Record<(typeof FIELDS)[number], string>;
  readOnly: boolean;
}) {
  const t = useTranslations("institution.settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await updateInstitutionAction(institutionId, prev, form);
    if (res.ok) {
      toast.success(t("saved"));
      router.refresh();
    }
    return res;
  }, idle);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <FormError state={state} />
      </div>
      {FIELDS.map((field) => (
        <div key={field} className={field === "address" || field === "name" ? "space-y-1.5 sm:col-span-2" : "space-y-1.5"}>
          <Label htmlFor={`inst-${field}`}>{t(`fields.${field}`)}</Label>
          <Input
            id={`inst-${field}`}
            name={field}
            defaultValue={defaults[field]}
            readOnly={readOnly}
            type={field === "phone" ? "tel" : field === "website" ? "url" : "text"}
            className="h-11"
          />
          <FieldError state={state} name={field} />
        </div>
      ))}
      {!readOnly && (
        <div className="sm:col-span-2">
          <SubmitButton pendingText={tc("saving")}>{tc("save")}</SubmitButton>
        </div>
      )}
    </form>
  );
}

export function RequestVerificationButton({ institutionId, disabled }: { institutionId: string; disabled: boolean }) {
  const t = useTranslations("institution.verification");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={disabled || pending}
      onClick={() =>
        start(async () => {
          const res = await requestVerificationAction(institutionId);
          if (res.ok) {
            toast.success(t("requested"));
            router.refresh();
          } else toast.error(res.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <BadgeCheck aria-hidden />} {t("request")}
    </Button>
  );
}
