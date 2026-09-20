"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { reviewProposalAction } from "@/modules/institutions/presentation/actions";

export function ProposalReview({ childId, proposalId }: { childId: string; proposalId: string }) {
  const t = useTranslations("proposals");
  const [pending, start] = useTransition();
  const decide = (decision: "ACCEPTED" | "REJECTED") =>
    start(async () => {
      const res = await reviewProposalAction(childId, proposalId, decision);
      if (res.ok) toast.success(decision === "ACCEPTED" ? t("accepted") : t("rejected"));
      else toast.error(res.message);
    });
  return (
    <div className="mt-3 flex gap-2">
      <Button type="button" onClick={() => decide("ACCEPTED")} disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} {t("accept")}
      </Button>
      <Button type="button" variant="outline" onClick={() => decide("REJECTED")} disabled={pending}>
        <X aria-hidden /> {t("reject")}
      </Button>
    </div>
  );
}
