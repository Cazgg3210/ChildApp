"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FormError, SubmitButton } from "@/components/feature/form-feedback";
import { adminResetSettingAction, adminSaveFeaturesAction, adminSaveSecurityAction } from "@/modules/platform/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

function ResetButton({ setting }: { setting: "security" | "features" }) {
  const t = useTranslations("admin.settings");
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await adminResetSettingAction(setting);
          if (res.ok) {
            toast.success(t("reset"));
            router.refresh();
          } else toast.error(res.message);
        })
      }
    >
      <Undo2 aria-hidden /> {t("useEnvironment")}
    </Button>
  );
}

function Toggle({ name, label, hint, checked, onChange }: { name: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border p-3">
      <div>
        <Label htmlFor={name}>{label}</Label>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch id={name} checked={checked} onCheckedChange={onChange} />
      <input type="hidden" name={name} value={checked ? "on" : "off"} />
    </div>
  );
}

export function SecurityForm({ defaults, source }: { defaults: { requireEmailVerification: boolean }; source: string }) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [v, setV] = useState(defaults.requireEmailVerification);
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await adminSaveSecurityAction(prev, form);
    if (res.ok) {
      toast.success(t("saved"));
      router.refresh();
    }
    return res;
  }, idle);
  return (
    <form action={action} className="space-y-4" noValidate>
      <FormError state={state} />
      <Toggle name="requireEmailVerification" label={t("requireEmailVerification")} hint={t("requireEmailVerificationHint")} checked={v} onChange={setV} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText={tc("saving")}>{tc("save")}</SubmitButton>
        {source === "database" && <ResetButton setting="security" />}
      </div>
    </form>
  );
}

export function FeaturesForm({
  defaults,
  source,
}: {
  defaults: { aiProfileAssistant: boolean; institutionPortal: boolean; documentVerification: boolean };
  source: string;
}) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const router = useRouter();
  const [ai, setAi] = useState(defaults.aiProfileAssistant);
  const [portal, setPortal] = useState(defaults.institutionPortal);
  const [docs, setDocs] = useState(defaults.documentVerification);
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await adminSaveFeaturesAction(prev, form);
    if (res.ok) {
      toast.success(t("saved"));
      router.refresh();
    }
    return res;
  }, idle);
  return (
    <form action={action} className="space-y-3" noValidate>
      <FormError state={state} />
      <Toggle name="aiProfileAssistant" label={t("flags.ai")} hint={t("flags.aiHint")} checked={ai} onChange={setAi} />
      <Toggle name="institutionPortal" label={t("flags.portal")} hint={t("flags.portalHint")} checked={portal} onChange={setPortal} />
      <Toggle name="documentVerification" label={t("flags.docs")} hint={t("flags.docsHint")} checked={docs} onChange={setDocs} />
      <div className="flex flex-wrap gap-2 pt-1">
        <SubmitButton pendingText={tc("saving")}>{tc("save")}</SubmitButton>
        {source === "database" && <ResetButton setting="features" />}
      </div>
    </form>
  );
}
