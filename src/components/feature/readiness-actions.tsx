"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { declareNoneAction, reconfirmItemAction } from "@/modules/children/presentation/actions";
import type { ReadinessKey, ReadinessState } from "@/modules/profiles/domain/readiness";

/** Inline actions for one readiness check: declare "none", re-confirm stale facts, or add. */
export function ReadinessActions({
  childId,
  check,
  state,
  itemIds,
}: {
  childId: string;
  check: ReadinessKey;
  state: ReadinessState;
  itemIds: string[];
}) {
  const t = useTranslations("profile.readiness");
  const [pending, start] = useTransition();
  const addHref = `/app/children/${childId}/profile/${check === "emergencyContact" ? "emergency" : "health"}`;

  const declare = () =>
    start(async () => {
      const res = await declareNoneAction(childId, check === "allergies" ? "NO_KNOWN_ALLERGIES" : "NO_MEDICATIONS");
      if (!res.ok) toast.error(res.message);
      else toast.success(t("declared"));
    });

  const reconfirm = () =>
    start(async () => {
      for (const id of itemIds) {
        const res = await reconfirmItemAction(childId, id);
        if (!res.ok) {
          toast.error(res.message);
          return;
        }
      }
      toast.success(t("reconfirmed"));
    });

  if (state === "NEEDS_REVIEW") {
    return (
      <span className="flex gap-1">
        <Button type="button" size="sm" variant="outline" onClick={reconfirm} disabled={pending}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} {t("reconfirm")}
        </Button>
        <Button asChild size="sm" variant="ghost">
          <Link href={addHref}>{t("update")}</Link>
        </Button>
      </span>
    );
  }
  if (state === "UNKNOWN") {
    return (
      <span className="flex gap-1">
        {check !== "emergencyContact" && (
          <Button type="button" size="sm" variant="outline" onClick={declare} disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />}{" "}
            {check === "allergies" ? t("declareNoAllergies") : t("declareNoMedications")}
          </Button>
        )}
        <Button asChild size="sm" variant="secondary">
          <Link href={addHref}>{t("add")}</Link>
        </Button>
      </span>
    );
  }
  return null;
}
