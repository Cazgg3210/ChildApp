"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { KeyRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { SubmitButton } from "@/components/feature/form-feedback";
import { verifyPinAction } from "@/modules/care/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

export function PinForm({ token, childName, remaining }: { token: string; childName: string; remaining: number }) {
  const t = useTranslations("care.pass");
  const router = useRouter();
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await verifyPinAction(token, prev, form);
    if (res.ok) router.refresh();
    return res;
  }, idle);

  const locked = !state.ok && state.code === "PIN_LOCKED";
  const invalid = !state.ok && state.code === "PIN_INVALID";
  const attemptsLeft = invalid ? Number(state.message) || 0 : remaining;

  return (
    <div className="flex flex-col items-center py-12 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <KeyRound className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">{t("pinTitle")}</h1>
      <p className="mt-2 text-muted-foreground">{t("pinHint", { name: childName })}</p>
      {locked ? (
        <Alert variant="destructive" className="mt-6 text-left">
          <AlertTitle>{t("pinLocked")}</AlertTitle>
        </Alert>
      ) : (
        <form action={action} className="mt-6 w-full max-w-xs space-y-4" noValidate>
          {invalid && (
            <Alert variant="destructive" className="text-left">
              <AlertTitle>{t("pinInvalid", { remaining: attemptsLeft })}</AlertTitle>
            </Alert>
          )}
          {!state.ok && !invalid && !locked && state.message && (
            <Alert variant="destructive" className="text-left">
              <AlertTitle>{state.message}</AlertTitle>
            </Alert>
          )}
          <div className="space-y-1.5 text-left">
            <Label htmlFor="pin">{t("pinLabel")}</Label>
            <Input
              id="pin"
              name="pin"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              autoComplete="one-time-code"
              autoFocus
              required
              className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
            />
          </div>
          <SubmitButton className="h-12 w-full text-base">{t("pinSubmit")}</SubmitButton>
        </form>
      )}
    </div>
  );
}
