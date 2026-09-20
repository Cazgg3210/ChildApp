"use client";

import { useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { structureNotesAction } from "@/modules/ai/presentation/actions";
import { addProfileItemsAction } from "@/modules/children/presentation/actions";
import type { ProposedItem } from "@/modules/ai/domain/types";
import type { ProfileSectionValue } from "@/shared/domain/care-vocabulary";

/** "Review before saving": the assistant proposes, the guardian decides. */
export function AssistantPanel({
  childId,
  sections,
  icon,
}: {
  childId: string;
  sections: ProfileSectionValue[];
  icon?: React.ReactNode;
}) {
  const t = useTranslations("profile.assistant");
  const tp = useTranslations("profile");
  const locale = useLocale();
  const [text, setText] = useState("");
  const [proposals, setProposals] = useState<ProposedItem[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();

  const analyze = () =>
    start(async () => {
      const res = await structureNotesAction({ childId, text, locale });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      const items = res.data?.items ?? [];
      setProposals(items);
      setSelected(new Set(items.map((_, i) => i)));
    });

  const save = () =>
    start(async () => {
      const chosen = (proposals ?? [])
        .filter((_, i) => selected.has(i))
        .map((p) => ({
          section: p.section,
          itemType: p.itemType,
          label: p.label,
          details: p.details ?? null,
          data: p.data ?? null,
        }));
      const res = await addProfileItemsAction(childId, chosen);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(tp("actions.saved"));
      setProposals(null);
      setText("");
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          {icon} {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">{t("hint")}</p>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          placeholder={t("placeholder")}
          maxLength={4000}
        />
        <Button type="button" onClick={analyze} disabled={pending || text.trim().length < 3} className="w-full">
          {pending && <Loader2 className="animate-spin" aria-hidden />} {t("analyze")}
        </Button>
        {proposals && (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <p className="font-medium">{t("reviewTitle")}</p>
            {proposals.length === 0 ? (
              <p className="text-muted-foreground">{t("nothingFound")}</p>
            ) : (
              <ul className="space-y-2">
                {proposals.map((p, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Checkbox
                      id={`prop-${i}`}
                      checked={selected.has(i)}
                      onCheckedChange={(v) => {
                        const next = new Set(selected);
                        if (v) next.add(i);
                        else next.delete(i);
                        setSelected(next);
                      }}
                    />
                    <label htmlFor={`prop-${i}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">
                        {tp(`sections.${p.section}.short`)} ·{" "}
                        {tp.has(`itemTypes.${p.itemType}`) ? tp(`itemTypes.${p.itemType}`) : p.itemType}
                      </span>
                      <span className="font-medium">{p.label}</span>
                      {p.data && typeof p.data === "object" && Object.values(p.data).filter(Boolean).length > 0 && (
                        <span className="block text-muted-foreground">
                          {Object.values(p.data).filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {proposals.length > 0 && (
              <Button
                type="button"
                size="sm"
                onClick={save}
                disabled={pending || selected.size === 0}
                className="w-full"
              >
                {t("saveSelected")} ({selected.size})
              </Button>
            )}
          </div>
        )}
        <p className="text-xs text-muted-foreground">{t("disclaimer")}</p>
        <span className="sr-only">{sections.join(", ")}</span>
      </CardContent>
    </Card>
  );
}
