"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Building2, Loader2, QrCode, ShieldOff, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatusPill } from "@/components/feature/badges";
import { ShareResultView } from "@/components/feature/share-result";
import { revokeShareAction, rotateShareLinkAction, type ShareResult } from "@/modules/sharing/presentation/actions";
import { formatDateTime, formatRelative } from "@/shared/utils/dates";

export interface GrantCardData {
  id: string;
  recipientName: string;
  recipientKind: "FAMILY" | "BABYSITTER" | "INSTITUTION" | "OTHER";
  effectiveStatus: "PENDING" | "ACTIVE" | "REVOKED" | "EXPIRED" | "NOT_STARTED" | "EXHAUSTED";
  dataCategories: string[];
  startsAt: Date;
  expiresAt: Date | null;
  hasLink: boolean;
  hasPin: boolean;
  useCount: number;
  lastUsedAt: Date | null;
  lastAcknowledgedAt: Date | null;
  note: string | null;
}

export function GrantCard({ childId, grant, locale }: { childId: string; grant: GrantCardData; locale: string }) {
  const t = useTranslations("sharing");
  const [pending, start] = useTransition();
  const [rotated, setRotated] = useState<ShareResult | null>(null);
  const isLive =
    grant.effectiveStatus === "ACTIVE" ||
    grant.effectiveStatus === "NOT_STARTED" ||
    grant.effectiveStatus === "PENDING";
  const tone =
    grant.effectiveStatus === "ACTIVE"
      ? "active"
      : grant.effectiveStatus === "PENDING" || grant.effectiveStatus === "NOT_STARTED"
        ? "pending"
        : "inactive";

  const revoke = () =>
    start(async () => {
      if (!window.confirm(t("grant.revokeConfirm", { name: grant.recipientName }))) return;
      const res = await revokeShareAction(childId, grant.id);
      if (res.ok) toast.success(t("grant.revoked"));
      else toast.error(res.message);
    });

  const rotate = () =>
    start(async () => {
      const res = await rotateShareLinkAction(childId, grant.id);
      if (res.ok && res.data) setRotated(res.data);
      else if (!res.ok) toast.error(res.message);
    });

  return (
    <article className="flex h-full flex-col rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            {grant.recipientKind === "INSTITUTION" ? (
              <Building2 className="size-5" aria-hidden />
            ) : (
              <Users className="size-5" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="truncate font-semibold">{grant.recipientName}</p>
            <p className="text-xs text-muted-foreground">{t(`kinds.${grant.recipientKind}`)}</p>
          </div>
        </div>
        <StatusPill tone={tone}>{t(`status.${grant.effectiveStatus}`)}</StatusPill>
      </div>

      <dl className="mt-3 space-y-1 text-sm text-muted-foreground">
        <div>
          {grant.effectiveStatus === "NOT_STARTED"
            ? t("grant.validFrom", { when: formatDateTime(grant.startsAt, locale) })
            : grant.expiresAt
              ? t("grant.validUntil", { when: formatDateTime(grant.expiresAt, locale) })
              : t("grant.noExpiry")}
        </div>
        {grant.hasLink && (
          <div>
            {grant.lastUsedAt
              ? t("grant.lastOpened", { when: formatRelative(grant.lastUsedAt, locale) })
              : t("grant.neverOpened")}{" "}
            · {t("grant.uses", { count: grant.useCount })}
            {grant.hasPin && ` · ${t("preview.pinProtected")}`}
          </div>
        )}
        <div className={grant.lastAcknowledgedAt ? "text-success" : ""}>
          {grant.lastAcknowledgedAt
            ? t("grant.acknowledged", { when: formatRelative(grant.lastAcknowledgedAt, locale) })
            : t("grant.notAcknowledged")}
        </div>
      </dl>

      <p className="mt-3 flex flex-wrap gap-1">
        {grant.dataCategories
          .filter((c) => c !== "IDENTITY")
          .map((c) => (
            <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
              {t(`categories.${c}`)}
            </span>
          ))}
      </p>

      {isLive && (
        <div className="mt-4 flex flex-wrap gap-2 border-t pt-3">
          {grant.hasLink && grant.effectiveStatus === "ACTIVE" && (
            <Button type="button" variant="outline" size="sm" onClick={rotate} disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <QrCode aria-hidden />}{" "}
              {t("grant.viewLink")}
            </Button>
          )}
          <Button type="button" variant="destructive" size="sm" onClick={revoke} disabled={pending}>
            <ShieldOff aria-hidden /> {t("grant.revoke")}
          </Button>
        </div>
      )}

      <Dialog open={Boolean(rotated)} onOpenChange={(o) => !o && setRotated(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("grant.viewLink")}</DialogTitle>
            <DialogDescription>{t("result.qrHint")}</DialogDescription>
          </DialogHeader>
          {rotated && <ShareResultView result={rotated} childId={childId} childName={grant.recipientName} />}
        </DialogContent>
      </Dialog>
    </article>
  );
}
