"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Copy, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import type { ShareResult } from "@/modules/sharing/presentation/actions";

/** Shown exactly once after creating/rotating a link: the token is never stored in plaintext. */
export function ShareResultView({
  result,
  childId,
  childName,
}: {
  result: ShareResult;
  childId: string;
  childName: string;
}) {
  const t = useTranslations("sharing.result");
  const tc = useTranslations("common");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!result.url) return;
    await navigator.clipboard.writeText(result.url);
    setCopied(true);
    toast.success(tc("copied"));
    setTimeout(() => setCopied(false), 2000);
  };

  const share = async () => {
    if (!result.url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${childName} · Care Pass`, url: result.url });
      } catch {
        /* user cancelled */
      }
    } else {
      await copy();
    }
  };

  return (
    <Card>
      <CardContent className="space-y-6 pt-6">
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 inline-flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
            <Check className="size-6" aria-hidden />
          </span>
          <h2 className="text-2xl font-semibold">{t("title")}</h2>
          <p className="mt-1 max-w-md text-muted-foreground">
            {result.isInstitution
              ? t("institutionSent", { name: childName })
              : t("body", { name: result.recipientName })}
          </p>
        </div>

        {result.url && (
          <>
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("link")}</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={result.url}
                  className="h-11 min-w-0 flex-1 rounded-lg border bg-muted/40 px-3 font-mono text-xs"
                  aria-label={t("link")}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button type="button" variant="outline" onClick={copy} className="h-11" aria-label={tc("copy")}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {tc("copy")}
                </Button>
              </div>
            </div>
            {result.qrDataUrl && (
              <div className="flex flex-col items-center gap-2">
                <p className="text-sm font-medium">{t("qr")}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={result.qrDataUrl}
                  alt={`QR · ${childName}`}
                  width={240}
                  height={240}
                  className="rounded-2xl border bg-white p-2"
                />
                <p className="text-xs text-muted-foreground">{t("qrHint")}</p>
              </div>
            )}
            {result.hasPin && (
              <Alert>
                <AlertTitle>{t("pinReminder")}</AlertTitle>
              </Alert>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button type="button" size="lg" onClick={share}>
                <Share2 aria-hidden /> {t("share")}
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href={`/app/children/${childId}/network`}>{t("done")}</Link>
              </Button>
            </div>
          </>
        )}
        {!result.url && (
          <div className="flex justify-center">
            <Button asChild size="lg">
              <Link href={`/app/children/${childId}/network`}>{t("done")}</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
