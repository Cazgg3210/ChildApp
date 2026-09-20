"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ClipboardCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { institutionAcknowledgeAction } from "@/modules/institutions/presentation/actions";

export function AcknowledgeButton({
  institutionId,
  childId,
  label,
}: {
  institutionId: string;
  childId: string;
  label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      className="w-full whitespace-normal py-2 text-left"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const res = await institutionAcknowledgeAction(institutionId, childId);
          if (!res.ok) toast.error(res.message);
        })
      }
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ClipboardCheck aria-hidden />} {label}
    </Button>
  );
}
