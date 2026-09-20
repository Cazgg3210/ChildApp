"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { MessageSquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import { proposeChangeAction } from "@/modules/institutions/presentation/actions";
import { ITEM_TYPES, type ItemType } from "@/modules/profiles/domain/catalog";
import { PROFILE_SECTIONS, type ProfileSectionValue } from "@/shared/domain/care-vocabulary";
import { idle, type ActionState } from "@/shared/http/action-state";

/** Institutions never edit the profile: they propose, the guardian decides. */
export function ProposeDialog({
  institutionId,
  childId,
  childName,
}: {
  institutionId: string;
  childId: string;
  childName: string;
}) {
  const t = useTranslations("institution.child");
  const tp = useTranslations("profile");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<ProfileSectionValue>("SOCIAL");
  const [itemType, setItemType] = useState<ItemType>("OBSERVATION");
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await proposeChangeAction(institutionId, childId, prev, form);
    if (res.ok) {
      toast.success(t("proposed"));
      setOpen(false);
    }
    return res;
  }, idle);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <MessageSquarePlus aria-hidden /> {t("propose")}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("proposeTitle")}</DialogTitle>
          <DialogDescription>{t("proposeBody")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4" noValidate>
          <FormError state={state} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="p-section">{t("proposeSection")}</Label>
              <NativeSelect
                id="p-section"
                name="section"
                value={section}
                onChange={(e) => {
                  const next = e.target.value as ProfileSectionValue;
                  setSection(next);
                  setItemType(ITEM_TYPES[next][0]);
                }}
              >
                {PROFILE_SECTIONS.map((s) => (
                  <option key={s} value={s}>
                    {tp(`sections.${s}.name`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-type">{tp("fields.type")}</Label>
              <NativeSelect
                id="p-type"
                name="itemType"
                value={itemType}
                onChange={(e) => setItemType(e.target.value as ItemType)}
              >
                {(ITEM_TYPES[section] as readonly ItemType[]).map((ty) => (
                  <option key={ty} value={ty}>
                    {tp(`itemTypes.${ty}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-label">{t("proposeLabel")}</Label>
            <Input id="p-label" name="label" required minLength={3} maxLength={120} className="h-11" />
            <FieldError state={state} name="label" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-details">{t("proposeDetails")}</Label>
            <Textarea id="p-details" name="details" rows={4} maxLength={2000} placeholder={t("proposePlaceholder")} />
            {section === "SOCIAL" && (
              <p className="text-xs leading-relaxed text-muted-foreground">{tp("socialGuidance")}</p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton>{t("proposeSubmit")}</SubmitButton>
          </div>
          <span className="sr-only">{childName}</span>
        </form>
      </DialogContent>
    </Dialog>
  );
}
