"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { updateAccountAction } from "@/modules/identity/presentation/account-actions";
import { idle, type ActionState } from "@/shared/http/action-state";

const TIMEZONES = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Cancun",
  "America/Tijuana",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "Europe/London",
];

export function SettingsForm({ defaults }: { defaults: { name: string; locale: string; timezone: string } }) {
  const t = useTranslations("settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await updateAccountAction(prev, form);
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
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="name">{t("name")}</Label>
        <Input id="name" name="name" defaultValue={defaults.name} required className="h-11" />
        <FieldError state={state} name="name" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="locale">{t("language")}</Label>
        <NativeSelect id="locale" name="locale" defaultValue={defaults.locale}>
          <option value="es">Español</option>
          <option value="en">English</option>
        </NativeSelect>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="timezone">{t("timezone")}</Label>
        <NativeSelect id="timezone" name="timezone" defaultValue={defaults.timezone}>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton pendingText={tc("saving")}>{tc("save")}</SubmitButton>
      </div>
    </form>
  );
}
