"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import type { ProfileItem } from "@/generated/prisma/client";
import type { ProfileSectionValue } from "@/shared/domain/care-vocabulary";
import { ITEM_DATA_FIELDS, ITEM_TYPES, defaultCriticality, type ItemType } from "@/modules/profiles/domain/catalog";
import { removeProfileItemAction, saveProfileItemAction } from "@/modules/children/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";
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
import { itemData } from "./profile-item-card";

const SEVERITIES = ["severe", "moderate", "mild"] as const;

export function ProfileItemDialog({
  childId,
  section,
  item,
  defaultType,
  trigger,
}: {
  childId: string;
  section: ProfileSectionValue;
  item?: ProfileItem;
  defaultType?: ItemType;
  trigger?: React.ReactNode;
}) {
  const t = useTranslations("profile");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const types = ITEM_TYPES[section] as readonly ItemType[];
  const [itemType, setItemType] = useState<ItemType>((item?.itemType as ItemType) ?? defaultType ?? types[0]);
  const [criticality, setCriticality] = useState(item?.criticality ?? defaultCriticality(itemType));
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await saveProfileItemAction(childId, item?.id ?? null, prev, form);
    if (res.ok) {
      toast.success(t("actions.saved"));
      setOpen(false);
    }
    return res;
  }, idle);
  const existingData = item ? itemData(item) : {};

  const onTypeChange = (next: ItemType) => {
    setItemType(next);
    if (!item) setCriticality(defaultCriticality(next));
  };

  const dataFields = ITEM_DATA_FIELDS[itemType] ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant={item ? "ghost" : "default"}
            size={item ? "icon-sm" : "default"}
            aria-label={item ? t("actions.editItem") : t("actions.addItem")}
          >
            {item ? <Pencil /> : <Plus />}
            {!item && t("actions.addItem")}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? t("actions.editItem") : t("actions.addItem")}</DialogTitle>
          <DialogDescription>{t(`sections.${section}.description`)}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4" noValidate>
          <input type="hidden" name="section" value={section} />
          <FormError state={state} />

          <div className="space-y-1.5">
            <Label htmlFor="itemType">{t("fields.type")}</Label>
            <NativeSelect
              id="itemType"
              name="itemType"
              value={itemType}
              onChange={(e) => onTypeChange(e.target.value as ItemType)}
            >
              {types.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`itemTypes.${ty}`)}
                </option>
              ))}
            </NativeSelect>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="label">{t("fields.label")}</Label>
            <Input
              id="label"
              name="label"
              defaultValue={item?.label ?? ""}
              required
              maxLength={120}
              className="h-11"
              autoFocus
            />
            <FieldError state={state} name="label" />
          </div>

          {dataFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <input type="hidden" name="dataKey" value={f.key} />
              <Label htmlFor={`data.${f.key}`}>{t(`fields.${f.key}`)}</Label>
              {f.key === "severity" ? (
                <NativeSelect id={`data.${f.key}`} name={`data.${f.key}`} defaultValue={existingData[f.key] ?? ""}>
                  <option value="">—</option>
                  {SEVERITIES.map((s) => (
                    <option key={s} value={s}>
                      {t(`fields.${s}`)}
                    </option>
                  ))}
                </NativeSelect>
              ) : (
                <Input
                  id={`data.${f.key}`}
                  name={`data.${f.key}`}
                  type={f.kind === "tel" ? "tel" : f.kind === "time" ? "time" : "text"}
                  defaultValue={existingData[f.key] ?? ""}
                  className="h-11"
                />
              )}
            </div>
          ))}

          <div className="space-y-1.5">
            <Label htmlFor="details">{t("fields.details")}</Label>
            <Textarea
              id="details"
              name="details"
              defaultValue={item?.details ?? ""}
              rows={3}
              maxLength={2000}
              placeholder={t("fields.detailsHint")}
            />
            {section === "SOCIAL" && (
              <p className="text-xs leading-relaxed text-muted-foreground">{t("socialGuidance")}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="criticality">{t("fields.criticality")}</Label>
              <NativeSelect
                id="criticality"
                name="criticality"
                value={criticality}
                onChange={(e) => setCriticality(e.target.value as typeof criticality)}
              >
                {(["CRITICAL", "IMPORTANT", "INFORMATIONAL"] as const).map((c) => (
                  <option key={c} value={c}>
                    {t(`criticality.${c}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provenance">{t("fields.provenanceStatus")}</Label>
              <NativeSelect id="provenance" name="provenance" defaultValue={item?.provenance ?? "SELF_DECLARED"}>
                {(["SELF_DECLARED", "OBSERVED", "DOCUMENTED", "VERIFIED"] as const).map((p) => (
                  <option key={p} value={p}>
                    {t(`provenance.${p}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="sourceType">{t("provenance.source")}</Label>
              <NativeSelect id="sourceType" name="sourceType" defaultValue={item?.sourceType ?? "GUARDIAN"}>
                {(["GUARDIAN", "FAMILY", "CAREGIVER", "INSTITUTION", "PROFESSIONAL", "DOCUMENT"] as const).map((s) => (
                  <option key={s} value={s}>
                    {t(`provenance.sourceType.${s}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sourceLabel">{t("fields.sourceLabel")}</Label>
              <Input
                id="sourceLabel"
                name="sourceLabel"
                defaultValue={item?.sourceLabel ?? ""}
                maxLength={120}
                className="h-11"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton pendingText={tc("saving")}>{tc("save")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DeleteItemButton({ childId, itemId }: { childId: string; itemId: string }) {
  const t = useTranslations("profile.actions");
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={t("deleteItem")}
      disabled={pending}
      onClick={async () => {
        if (!window.confirm(t("deleteConfirm"))) return;
        setPending(true);
        const res = await removeProfileItemAction(childId, itemId);
        setPending(false);
        if (res.ok) toast.success(t("deleted"));
        else toast.error(res.message);
      }}
    >
      <Trash2 />
    </Button>
  );
}
