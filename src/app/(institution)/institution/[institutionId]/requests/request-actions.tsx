"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptRequestAction, declineRequestAction } from "@/modules/institutions/presentation/actions";

export function RequestActions({
  institutionId,
  relationId,
  childName,
}: {
  institutionId: string;
  relationId: string;
  childName: string;
}) {
  const t = useTranslations("institution.requests");
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await acceptRequestAction(institutionId, relationId);
            if (res.ok) toast.success(t("accepted", { child: childName }));
            else toast.error(res.message);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} {t("accept")}
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await declineRequestAction(institutionId, relationId);
            if (res.ok) toast.success(t("declined"));
            else toast.error(res.message);
          })
        }
      >
        <X aria-hidden /> {t("decline")}
      </Button>
    </div>
  );
}
