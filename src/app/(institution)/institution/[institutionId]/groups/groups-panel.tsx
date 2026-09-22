"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DoorOpen, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EmptyState } from "@/components/feature/page-header";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import {
  createGroupAction,
  deleteGroupAction,
  setGroupChildAction,
  setGroupMemberAction,
} from "@/modules/institutions/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

interface Group {
  id: string;
  name: string;
  memberIds: string[];
  relationIds: string[];
}

export function GroupsPanel({
  institutionId,
  isAdmin,
  groups,
  members,
  pupils,
}: {
  institutionId: string;
  isAdmin: boolean;
  groups: Group[];
  members: { id: string; name: string; role: "ADMIN" | "MEMBER"; title: string | null }[];
  pupils: { relationId: string; name: string }[];
}) {
  const t = useTranslations("institution.groups");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [state, createAction] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await createGroupAction(institutionId, prev, form);
    if (res.ok) toast.success(t("created"));
    return res;
  }, idle);
  const [name, setName] = useState("");

  const toggleMember = (groupId: string, memberId: string, on: boolean) =>
    start(async () => {
      const res = await setGroupMemberAction(institutionId, groupId, memberId, on);
      if (!res.ok) toast.error(res.message);
    });
  const toggleChild = (groupId: string, relationId: string, on: boolean) =>
    start(async () => {
      const res = await setGroupChildAction(institutionId, groupId, relationId, on);
      if (!res.ok) toast.error(res.message);
    });
  const remove = (group: Group) =>
    start(async () => {
      if (!window.confirm(t("deleteConfirm", { name: group.name }))) return;
      const res = await deleteGroupAction(institutionId, group.id);
      if (!res.ok) toast.error(res.message);
    });

  const unassigned = pupils.filter((c) => !groups.some((g) => g.relationIds.includes(c.relationId)));

  return (
    <div className="space-y-6">
      {groups.length > 0 && (
        <Alert>
          <DoorOpen />
          <AlertDescription>{t("scopingNote")}</AlertDescription>
        </Alert>
      )}
      {isAdmin && (
        <form
          action={(form) => {
            createAction(form);
            setName("");
          }}
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          noValidate
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="group-name">{t("name")}</Label>
            <Input
              id="group-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("namePlaceholder")}
              className="h-11"
            />
            <FieldError state={state} name="name" />
          </div>
          <SubmitButton size="default" className="h-11" disabled={name.trim().length < 2}>
            <Plus aria-hidden /> {t("create")}
          </SubmitButton>
        </form>
      )}
      <FormError state={state} />

      {groups.length === 0 ? (
        <EmptyState icon={DoorOpen} title={t("emptyTitle")} body={t("emptyBody")} />
      ) : (
        <ul className="space-y-4">
          {groups.map((group) => (
            <li key={group.id}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">{group.name}</CardTitle>
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`${tc("delete")} ${group.name}`}
                      onClick={() => remove(group)}
                      disabled={pending}
                    >
                      <Trash2 />
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="grid gap-6 sm:grid-cols-2">
                  <fieldset disabled={!isAdmin || pending}>
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("team")}
                    </legend>
                    {members.length === 0 && <p className="text-sm text-muted-foreground">—</p>}
                    <ul className="space-y-2">
                      {members.map((m) => (
                        <li key={m.id}>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={group.memberIds.includes(m.id)}
                              onCheckedChange={(v) => toggleMember(group.id, m.id, Boolean(v))}
                              aria-label={`${group.name}: ${m.name}`}
                            />
                            <span>
                              {m.name}
                              <span className="text-muted-foreground">
                                {m.title ? ` · ${m.title}` : m.role === "ADMIN" ? ` · ${t("adminSeesAll")}` : ""}
                              </span>
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                  <fieldset disabled={!isAdmin || pending}>
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {t("children")}
                    </legend>
                    {pupils.length === 0 && <p className="text-sm text-muted-foreground">{t("noChildren")}</p>}
                    <ul className="space-y-2">
                      {pupils.map((c) => (
                        <li key={c.relationId}>
                          <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={group.relationIds.includes(c.relationId)}
                              onCheckedChange={(v) => toggleChild(group.id, c.relationId, Boolean(v))}
                              aria-label={`${group.name}: ${c.name}`}
                            />
                            {c.name}
                          </label>
                        </li>
                      ))}
                    </ul>
                  </fieldset>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {groups.length > 0 && unassigned.length > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("unassigned", { count: unassigned.length, names: unassigned.map((c) => c.name).join(", ") })}
        </p>
      )}
    </div>
  );
}
