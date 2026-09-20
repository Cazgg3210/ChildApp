"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { addMemberAction, removeMemberAction } from "@/modules/institutions/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

interface MemberRow {
  userId: string;
  name: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  title: string | null;
}

export function MembersPanel({
  institutionId,
  currentUserId,
  isAdmin,
  members,
}: {
  institutionId: string;
  currentUserId: string;
  isAdmin: boolean;
  members: MemberRow[];
}) {
  const t = useTranslations("institution.members");
  const tc = useTranslations("common");
  const ta = useTranslations("auth.fields");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await addMemberAction(institutionId, prev, form);
    if (res.ok) setOpen(false);
    return res;
  }, idle);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-end">
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
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
                  <Label htmlFor="m-email">{ta("email")}</Label>
                  <Input id="m-email" name="email" type="email" required className="h-11" />
                  <FieldError state={state} name="email" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-role">{t("role")}</Label>
                  <NativeSelect id="m-role" name="role" defaultValue="MEMBER">
                    <option value="MEMBER">{t("roles.MEMBER")}</option>
                    <option value="ADMIN">{t("roles.ADMIN")}</option>
                  </NativeSelect>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-title">{t("titleLabel")}</Label>
                  <Input id="m-title" name="title" className="h-11" />
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
        <ul className="divide-y">
          {members.map((m) => (
            <li key={m.userId} className="flex items-center justify-between gap-2 py-3 text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t(`roles.${m.role}`)}
                  {m.title ? ` · ${m.title}` : ""} · {m.email}
                </p>
              </div>
              {isAdmin && m.userId !== currentUserId && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("remove")}
                  onClick={async () => {
                    if (!window.confirm(`${t("remove")}: ${m.name}?`)) return;
                    const res = await removeMemberAction(institutionId, m.userId);
                    if (!res.ok) toast.error(res.message);
                  }}
                >
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
