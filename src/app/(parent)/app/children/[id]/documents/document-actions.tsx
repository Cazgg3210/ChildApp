"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ExternalLink, Loader2, Trash2, Upload } from "lucide-react";
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
import { NativeSelect } from "@/components/ui/native-select";
import { FieldError, FormError, SubmitButton } from "@/components/feature/form-feedback";
import {
  deleteDocumentAction,
  documentUrlAction,
  uploadDocumentAction,
} from "@/modules/documents/presentation/actions";
import { idle, type ActionState } from "@/shared/http/action-state";

const CATEGORIES = ["VACCINATION", "CERTIFICATE", "INSURANCE", "AUTHORIZATION", "MEDICAL", "OTHER"] as const;

export function UploadDocumentDialog({ childId }: { childId: string }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(async (prev: ActionState, form: FormData) => {
    const res = await uploadDocumentAction(childId, prev, form);
    if (res.ok) setOpen(false);
    return res;
  }, idle);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload aria-hidden /> {t("upload")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("upload")}</DialogTitle>
          <DialogDescription>{t("fileHint")}</DialogDescription>
        </DialogHeader>
        <form action={action} className="space-y-4" noValidate>
          <FormError state={state} />
          <div className="space-y-1.5">
            <Label htmlFor="d-title">{t("titleLabel")}</Label>
            <Input id="d-title" name="title" required className="h-11" />
            <FieldError state={state} name="title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-category">{t("category")}</Label>
            <NativeSelect id="d-category" name="category" defaultValue="OTHER">
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c}`)}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="d-file">{t("file")}</Label>
            <Input
              id="d-file"
              name="file"
              type="file"
              accept="application/pdf,image/*"
              required
              className="h-11 pt-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <SubmitButton>{t("upload")}</SubmitButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function DocumentActions({ childId, documentId }: { childId: string; documentId: string }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  return (
    <div className="flex shrink-0 gap-1">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        title={t("openHint")}
        onClick={() =>
          start(async () => {
            const res = await documentUrlAction(documentId);
            if (res.ok && res.data) window.open(res.data.url, "_blank", "noopener");
            else if (!res.ok) toast.error(res.message);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ExternalLink aria-hidden />} {t("open")}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={tc("delete")}
        disabled={pending}
        onClick={() =>
          start(async () => {
            if (!window.confirm(`${tc("delete")}?`)) return;
            const res = await deleteDocumentAction(childId, documentId);
            if (!res.ok) toast.error(res.message);
          })
        }
      >
        <Trash2 />
      </Button>
    </div>
  );
}
