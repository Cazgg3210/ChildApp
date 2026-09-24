"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { BadgeCheck, Loader2, ShieldOff, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminSetInstitutionVerificationAction } from "@/modules/platform/presentation/actions";
import type { VerificationStatus } from "@/components/feature/verification-badge";

export function InstitutionVerificationActions({
  institutionId,
  status,
}: {
  institutionId: string;
  status: VerificationStatus;
}) {
  const t = useTranslations("admin.institutions");
  const [pending, start] = useTransition();
  const set = (next: VerificationStatus, confirm?: string) =>
    start(async () => {
      if (confirm && !window.confirm(confirm)) return;
      const res = await adminSetInstitutionVerificationAction(institutionId, next);
      if (res.ok) toast.success(t("updated"));
      else toast.error(res.message);
    });
  return (
    <div className="flex flex-wrap gap-2">
      {status !== "VERIFIED" && (
        <Button size="sm" onClick={() => set("VERIFIED")} disabled={pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <BadgeCheck aria-hidden />} {t("verify")}
        </Button>
      )}
      {status === "VERIFIED" && (
        <Button size="sm" variant="outline" onClick={() => set("UNVERIFIED", t("unverifyConfirm"))} disabled={pending}>
          <Undo2 aria-hidden /> {t("unverify")}
        </Button>
      )}
      {status !== "SUSPENDED" ? (
        <Button size="sm" variant="destructive" onClick={() => set("SUSPENDED", t("suspendConfirm"))} disabled={pending}>
          <ShieldOff aria-hidden /> {t("suspend")}
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={() => set("UNVERIFIED")} disabled={pending}>
          <Undo2 aria-hidden /> {t("lift")}
        </Button>
      )}
    </div>
  );
}
