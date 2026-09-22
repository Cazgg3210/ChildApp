"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormError, SubmitButton } from "@/components/feature/form-feedback";
import { requestDeletionAction } from "@/modules/identity/presentation/account-actions";
import { idle } from "@/shared/http/action-state";

/** Two-step account deletion: the user types the confirmation word before the request is sent. */
export function DeleteAccountButton({ soleAdminOf }: { soleAdminOf: string[] }) {
  const t = useTranslations("settings.deletion");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [state, action] = useActionState(requestDeletionAction, idle);
  const blocked = soleAdminOf.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive" size="sm">
          <Trash2 aria-hidden /> {t("cta")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        {blocked ? (
          <p className="rounded-xl bg-important-soft p-3 text-sm">{t("blocked", { names: soleAdminOf.join(", ") })}</p>
        ) : (
          <form action={action} className="space-y-4" noValidate>
            <FormError state={state} />
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>{t("consequences.children")}</li>
              <li>{t("consequences.access")}</li>
              <li>{t("consequences.grace")}</li>
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete">{t("typeToConfirm")}</Label>
              <Input
                id="confirm-delete"
                name="confirm"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                className="h-11 font-mono uppercase"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                {tc("cancel")}
              </Button>
              <SubmitButton variant="destructive" disabled={typed.trim().toUpperCase() !== "ELIMINAR"}>
                {t("confirm")}
              </SubmitButton>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
