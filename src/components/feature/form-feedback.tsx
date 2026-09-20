"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { ActionState } from "@/shared/http/action-state";
import { cn } from "@/lib/utils";

export function FormError({ state, className }: { state: ActionState<unknown> | undefined; className?: string }) {
  const t = useTranslations("errors");
  if (!state || state.ok) return null;
  const known = t.has(state.code) ? t(state.code) : state.message;
  return (
    <Alert variant="destructive" className={className} role="alert">
      <AlertTitle>{known}</AlertTitle>
      {state.message && state.message !== known && <AlertDescription>{state.message}</AlertDescription>}
    </Alert>
  );
}

export function FieldError({ state, name }: { state: ActionState<unknown> | undefined; name: string }) {
  if (!state || state.ok || !state.fieldErrors?.[name]) return null;
  return (
    <p className="mt-1 text-xs text-destructive" role="alert">
      {state.fieldErrors[name]}
    </p>
  );
}

export function SubmitButton({
  children,
  pendingText,
  className,
  variant,
  size = "lg",
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      size={size}
      variant={variant}
      disabled={pending || disabled}
      className={cn("tap-target", className)}
    >
      {pending && <Loader2 className="animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </Button>
  );
}
