"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { updateChildAction } from "@/modules/children/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

export function IdentityForm({
  childId,
  defaults,
}: {
  childId: string;
  defaults: {
    firstName: string;
    lastName: string;
    preferredName: string;
    dateOfBirth: string;
    primaryLanguage: string;
    secondaryLanguages: string;
  };
}) {
  const t = useTranslations("children.fields");
  const tc = useTranslations("common");
  const tp = useTranslations("profile.actions");
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await updateChildAction(childId, prev, form);
    if (res.ok) toast.success(tp("saved"));
    return res;
  }, idle);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2" noValidate>
      <div className="sm:col-span-2">
        <FormError state={state} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="firstName">{t("firstName")}</Label>
        <Input id="firstName" name="firstName" defaultValue={defaults.firstName} required className="h-11" />
        <FieldError state={state} name="firstName" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="lastName">{t("lastName")}</Label>
        <Input id="lastName" name="lastName" defaultValue={defaults.lastName} required className="h-11" />
        <FieldError state={state} name="lastName" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="preferredName">{t("preferredName")}</Label>
        <Input id="preferredName" name="preferredName" defaultValue={defaults.preferredName} className="h-11" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="dateOfBirth">{t("dateOfBirth")}</Label>
        <Input
          id="dateOfBirth"
          name="dateOfBirth"
          type="date"
          defaultValue={defaults.dateOfBirth}
          required
          className="h-11"
        />
        <FieldError state={state} name="dateOfBirth" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="primaryLanguage">{t("primaryLanguage")}</Label>
        <NativeSelect id="primaryLanguage" name="primaryLanguage" defaultValue={defaults.primaryLanguage}>
          <option value="es">Español</option>
          <option value="en">English</option>
          <option value="fr">Français</option>
          <option value="pt">Português</option>
          <option value="de">Deutsch</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="secondaryLanguages">{t("secondaryLanguages")}</Label>
        <Input
          id="secondaryLanguages"
          name="secondaryLanguages"
          defaultValue={defaults.secondaryLanguages}
          placeholder={t("secondaryLanguagesHint")}
          className="h-11"
        />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText={tc("saving")}>{tc("save")}</SubmitButton>
      </div>
    </form>
  );
}
