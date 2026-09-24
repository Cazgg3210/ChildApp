"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CopyButton } from "@/components/feature/copy-button";
import { adminSeedDemoAction } from "@/modules/platform/presentation/actions";
import type { DemoSeedResult } from "@/modules/demo/application/demo-seed";

export function DemoControls({ enabled, seeded, isDemoUser }: { enabled: boolean; seeded: boolean; isDemoUser: boolean }) {
  const t = useTranslations("admin.demo");
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState("");
  const [result, setResult] = useState<Extract<DemoSeedResult, { status: "created" }> | null>(null);

  const run = (reset: boolean) =>
    start(async () => {
      const res = await adminSeedDemoAction(reset);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      if (res.data?.status === "created") {
        setResult(res.data);
        toast.success(t("done"));
        router.refresh();
      } else toast.info(t("alreadySeeded"));
    });

  if (!enabled) return null;
  return (
    <div className="space-y-4">
      {!seeded && (
        <Button onClick={() => run(false)} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />} {t("seed")}
        </Button>
      )}
      {seeded && !isDemoUser && (
        <div className="space-y-2 rounded-xl border border-critical/30 bg-critical-soft/40 p-3">
          <p className="text-sm font-medium">{t("resetTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("resetHint")}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <Label htmlFor="confirm-demo">{t("typeToConfirm")}</Label>
              <Input id="confirm-demo" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="h-11 font-mono uppercase" />
            </div>
            <Button variant="destructive" className="h-11" disabled={pending || confirm.trim().toUpperCase() !== "DEMO"} onClick={() => run(true)}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <RefreshCw aria-hidden />} {t("reset")}
            </Button>
          </div>
        </div>
      )}
      {seeded && isDemoUser && <p className="text-xs text-muted-foreground">{t("resetNeedsRealAdmin")}</p>}
      {result && (
        <div className="space-y-2 rounded-xl border bg-muted/40 p-3 text-sm">
          <p className="font-medium">{t("linksTitle")}</p>
          <p className="text-xs text-muted-foreground">{t("linksHint")}</p>
          <p>
            {t("kinderCode")}: <code className="font-mono">{result.kinderInviteCode}</code>
          </p>
          <ul className="space-y-2">
            {result.carePassLinks.map((l) => (
              <li key={l.name} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  {l.name}
                  {l.pin ? ` · PIN ${l.pin}` : ""}
                  <br />
                  <code className="break-all text-xs text-muted-foreground">{l.url}</code>
                </span>
                {l.url && <CopyButton value={l.url} />}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
