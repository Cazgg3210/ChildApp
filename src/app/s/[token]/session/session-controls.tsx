"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EVENT_ICONS } from "@/components/feature/care-timeline";
import { endSessionAction, recordCareEventAction } from "@/modules/care/presentation/actions";
import type { CareEventType } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

const QUICK: CareEventType[] = [
  "FOOD",
  "WATER",
  "BATHROOM",
  "SLEEP",
  "WAKE",
  "MEDICATION",
  "ACTIVITY",
  "NOTE",
  "INCIDENT",
];

/** Big, thumb-friendly buttons: one tap opens a tiny note dialog, second tap records. */
export function SessionControls({ token, sessionId }: { token: string; sessionId: string }) {
  const t = useTranslations("care.session");
  const tc = useTranslations("common");
  const [pending, start] = useTransition();
  const [type, setType] = useState<CareEventType | null>(null);
  const [note, setNote] = useState("");

  const record = () => {
    if (!type) return;
    start(async () => {
      const res = await recordCareEventAction(token, { sessionId, type, note: note.trim() || null });
      if (res.ok) {
        toast.success(t("recorded"));
        setType(null);
        setNote("");
      } else toast.error(res.message);
    });
  };

  const end = () =>
    start(async () => {
      if (!window.confirm(t("endConfirm"))) return;
      const res = await endSessionAction(token, sessionId);
      if (!res.ok) toast.error(res.message);
    });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {QUICK.map((ev) => {
          const Icon = EVENT_ICONS[ev];
          return (
            <button
              key={ev}
              type="button"
              onClick={() => setType(ev)}
              className={cn(
                "flex min-h-20 flex-col items-center justify-center gap-1.5 rounded-2xl border bg-card p-2 text-xs font-semibold transition-colors active:translate-y-px",
                ev === "INCIDENT" ? "border-critical/40 text-critical hover:bg-critical-soft" : "hover:bg-muted",
              )}
            >
              <Icon className="size-6" aria-hidden />
              {t(`events.${ev}`)}
            </button>
          );
        })}
      </div>
      <Button type="button" variant="outline" size="lg" className="h-12 w-full" onClick={end} disabled={pending}>
        <Square aria-hidden /> {t("endButton")}
      </Button>

      <Dialog open={type !== null} onOpenChange={(o) => !o && setType(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{type ? t(`events.${type}`) : ""}</DialogTitle>
            <DialogDescription>{type === "INCIDENT" ? t("noteRequired") : t("note")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="ev-note" className="sr-only">
              {t("note")}
            </Label>
            <Textarea
              id="ev-note"
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={1000}
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setType(null)}>
              {tc("cancel")}
            </Button>
            <Button type="button" onClick={record} disabled={pending || (type === "INCIDENT" && !note.trim())}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} {t("record")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
