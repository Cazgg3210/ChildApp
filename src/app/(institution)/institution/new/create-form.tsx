"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { createInstitutionAction } from "@/modules/institutions/presentation/actions";
import { idle } from "@/shared/http/action-state";

const TYPES = ["DAYCARE", "KINDERGARTEN", "SCHOOL", "CAMP", "ACADEMY", "SPORTS", "THERAPY", "OTHER"] as const;

export function CreateInstitutionForm() {
  const t = useTranslations("institution.create");
  const [state, action] = useActionState(createInstitutionAction, idle);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <div className="space-y-1.5">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" required minLength={2} className="h-11" autoFocus />
        <FieldError state={state} name="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="type">{t("type")}</Label>
        <NativeSelect id="type" name="type" defaultValue="KINDERGARTEN">
          {TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {t(`types.${ty}`)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <SubmitButton className="w-full">{t("submit")}</SubmitButton>
    </form>
  );
}
