"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { addGuardianAction, removeGuardianAction } from "@/modules/children/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

interface GuardianRow {
  userId: string;
  name: string;
  email: string;
  role: "OWNER" | "CO_GUARDIAN";
  relationshipLabel: string | null;
}

export function GuardiansPanel({
  childId,
  currentUserId,
  isOwner,
  guardians,
}: {
  childId: string;
  currentUserId: string;
  isOwner: boolean;
  guardians: GuardianRow[];
}) {
  const t = useTranslations("children.guardians");
  const tc = useTranslations("common");
  const ta = useTranslations("auth.fields");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await addGuardianAction(childId, prev, form);
    if (res.ok) setOpen(false);
    return res;
  }, idle);

  const remove = async (userId: string) => {
    if (!window.confirm(t("remove") + "?")) return;
    const res = await removeGuardianAction(childId, userId);
    if (!res.ok) toast.error(res.code === "INVALID_STATE" ? t("cannotRemoveLastOwner") : res.message);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("title")}</CardTitle>
        {isOwner && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus aria-hidden /> {t("add")}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("add")}</DialogTitle>
                <DialogDescription>{t("addHint")}</DialogDescription>
              </DialogHeader>
              <form action={action} className="space-y-4" noValidate>
                <FormError state={state} />
                <div className="space-y-1.5">
                  <Label htmlFor="g-email">{ta("email")}</Label>
                  <Input id="g-email" name="email" type="email" required className="h-11" />
                  <FieldError state={state} name="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-role">{t("title")}</Label>
                  <NativeSelect id="g-role" name="role" defaultValue="CO_GUARDIAN">
                    <option value="CO_GUARDIAN">{t("coGuardian")}</option>
                    <option value="OWNER">{t("owner")}</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="g-rel">{t("relationship")}</Label>
                  <Input id="g-rel" name="relationshipLabel" className="h-11" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                    {tc("cancel")}
                  </Button>
                  <SubmitButton>{tc("add")}</SubmitButton>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {guardians.map((g) => (
            <li key={g.userId} className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">
                  {g.name} {g.userId === currentUserId && <span className="text-muted-foreground">{t("you")}</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {g.role === "OWNER" ? t("owner") : t("coGuardian")}
                  {g.relationshipLabel ? ` · ${g.relationshipLabel}` : ""} · {g.email}
                </p>
              </div>
              {isOwner && g.userId !== currentUserId && (
                <Button variant="ghost" size="icon-sm" aria-label={t("remove")} onClick={() => remove(g.userId)}>
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
