"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptInvitationAction, declineInvitationAction } from "@/modules/children/presentation/actions";

export function InvitationActions({ invitationId }: { invitationId: string }) {
  const t = useTranslations("children.invitations");
  const te = useTranslations("errors");
  const router = useRouter();
  const [pending, start] = useTransition();

  const accept = () =>
    start(async () => {
      const res = await acceptInvitationAction(invitationId);
      if (res.ok && res.data) {
        toast.success(t("accepted"));
        router.push(`/app/children/${res.data.childId}`);
      } else if (!res.ok) toast.error(te.has(res.code) ? te(res.code) : res.message);
    });

  const decline = () =>
    start(async () => {
      const res = await declineInvitationAction(invitationId);
      if (res.ok) {
        toast.success(t("declined"));
        router.push("/app");
      } else toast.error(res.message);
    });

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" onClick={accept} disabled={pending} size="lg">
        {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Check aria-hidden />} {t("accept")}
      </Button>
      <Button type="button" variant="outline" onClick={decline} disabled={pending} size="lg">
        <X aria-hidden /> {t("decline")}
      </Button>
    </div>
  );
}
