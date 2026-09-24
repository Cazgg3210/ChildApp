"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { adminResetSettingAction, adminSaveMailAction, adminSendTestMailAction } from "@/modules/platform/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

export function MailForm({
  defaults,
  hasPassword,
  source,
}: {
  defaults: { provider: "console" | "smtp"; host: string; port: string; secure: boolean; user: string; from: string };
  hasPassword: boolean;
  source: "database" | "environment";
}) {
  const t = useTranslations("admin.mail");
  const tc = useTranslations("common");
  const router = useRouter();
  const [provider, setProvider] = useState(defaults.provider);
  const [secure, setSecure] = useState(defaults.secure);
  const [pending, start] = useTransition();
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await adminSaveMailAction(prev, form);
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
        <Label htmlFor="provider">{t("provider")}</Label>
        <NativeSelect id="provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value as "console" | "smtp")}>
          <option value="console">{t("console")}</option>
          <option value="smtp">SMTP</option>
        </NativeSelect>
        <p className="text-xs text-muted-foreground">{provider === "console" ? t("consoleHint") : t("smtpHint")}</p>
      </div>
      {provider === "smtp" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="host">{t("host")}</Label>
            <Input id="host" name="host" defaultValue={defaults.host} placeholder="smtp.resend.com" className="h-11" />
            <FieldError state={state} name="host" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="port">{t("port")}</Label>
            <Input id="port" name="port" type="number" defaultValue={defaults.port} className="h-11" />
            <FieldError state={state} name="port" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="user">{t("user")}</Label>
            <Input id="user" name="user" defaultValue={defaults.user} autoComplete="off" className="h-11" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">{t("password")}</Label>
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder={hasPassword ? "••••••••" : ""} className="h-11" />
            <p className="text-xs text-muted-foreground">{hasPassword ? t("passwordKeep") : t("passwordHint")}</p>
          </div>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch id="secure" checked={secure} onCheckedChange={setSecure} />
            <input type="hidden" name="secure" value={secure ? "on" : "off"} />
            <Label htmlFor="secure">{t("secure")}</Label>
          </div>
        </>
      )}
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="from">{t("from")}</Label>
        <Input id="from" name="from" defaultValue={defaults.from} placeholder="Child Care Passport <no-reply@midominio.com>" className="h-11" />
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <SubmitButton pendingText={tc("saving")}>{tc("save")}</SubmitButton>
        {source === "database" && (
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() =>
              start(async () => {
                if (!window.confirm(t("resetConfirm"))) return;
                const res = await adminResetSettingAction("mail");
                if (res.ok) {
                  toast.success(t("reset"));
                  router.refresh();
                } else toast.error(res.message);
              })
            }
          >
            <Undo2 aria-hidden /> {t("useEnvironment")}
          </Button>
        )}
      </div>
    </form>
  );
}

export function TestMailForm({ defaultTo }: { defaultTo: string }) {
  const t = useTranslations("admin.mail");
  const te = useTranslations("errors");
  const [to, setTo] = useState(defaultTo);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await adminSendTestMailAction(to);
          if (res.ok && res.data) toast.success(t("testSent", { provider: res.data.provider === "smtp" ? "SMTP" : t("console") }));
          else if (!res.ok) toast.error(res.code === "INTERNAL_ERROR" ? res.message : te.has(res.code) ? te(res.code) : res.message);
        });
      }}
    >
      <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} className="h-11 sm:max-w-sm" required />
      <Button type="submit" variant="outline" className="h-11" disabled={pending || !to}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} {t("sendTest")}
      </Button>
    </form>
  );
}
