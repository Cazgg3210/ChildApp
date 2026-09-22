import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle, CheckCircle2, CircleDashed, ShieldCheck } from "lucide-react";
import type { ProfileItem } from "@/generated/prisma/client";
import { Progress } from "@/components/ui/progress";
import { careReadiness, enrichment, type CareReadiness, type ReadinessState } from "@/modules/profiles/domain/readiness";
import { cn } from "@/lib/utils";
import { ReadinessActions } from "./readiness-actions";

const STATE_ICON: Record<ReadinessState, React.ComponentType<{ className?: string }>> = {
  HAS_DATA: CheckCircle2,
  NONE_DECLARED: CheckCircle2,
  NEEDS_REVIEW: AlertTriangle,
  UNKNOWN: CircleDashed,
};

const STATE_TONE: Record<ReadinessState, string> = {
  HAS_DATA: "text-success",
  NONE_DECLARED: "text-success",
  NEEDS_REVIEW: "text-important-foreground",
  UNKNOWN: "text-muted-foreground",
};

/** Compact pill used in lists (children list, dashboard cards). */
export function ReadinessPill({ readiness, className }: { readiness: CareReadiness; className?: string }) {
  const t = useTranslations("profile.readiness");
  const tone = readiness.ready
    ? readiness.needsReview
      ? "bg-important-soft text-important-foreground"
      : "bg-success-soft text-success"
    : "bg-critical-soft text-critical";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tone, className)}>
      <ShieldCheck className="size-3" aria-hidden />
      {readiness.ready ? (readiness.needsReview ? t("review") : t("ready")) : t("notReady")}
    </span>
  );
}

/**
 * Care Readiness: the three safety facts a caregiver needs (allergies,
 * medication, emergency contact), each either recorded, explicitly declared
 * as "none", unknown or stale. Separate from enrichment on purpose: a family
 * is never pushed to fill everything to reach 100 %.
 */
export function ReadinessCard({
  childId,
  items,
  editable = false,
  showEnrichment = true,
  className,
}: {
  childId: string;
  items: ProfileItem[];
  editable?: boolean;
  showEnrichment?: boolean;
  className?: string;
}) {
  const t = useTranslations("profile.readiness");
  const readiness = careReadiness(items);
  const rich = enrichment(items);
  const itemIdsFor = (key: CareReadiness["checks"][number]["key"]) =>
    items
      .filter((i) =>
        key === "allergies"
          ? ["ALLERGY", "FOOD_ALLERGY", "NO_KNOWN_ALLERGIES"].includes(i.itemType)
          : key === "medications"
            ? ["MEDICATION", "NO_MEDICATIONS"].includes(i.itemType)
            : i.section === "EMERGENCY" && i.itemType === "CONTACT",
      )
      .map((i) => i.id);

  return (
    <section
      className={cn(
        "rounded-2xl border p-4",
        readiness.ready && !readiness.needsReview ? "border-success/40 bg-success-soft/40" : "bg-card",
        className,
      )}
      aria-labelledby={`readiness-${childId}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`readiness-${childId}`} className="flex items-center gap-2 font-semibold">
            <ShieldCheck className="size-4 text-primary" aria-hidden /> {t("title")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("hint")}</p>
        </div>
        <ReadinessPill readiness={readiness} />
      </div>
      <ul className="mt-3 space-y-2">
        {readiness.checks.map((check) => {
          const Icon = STATE_ICON[check.state];
          return (
            <li key={check.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className={cn("flex items-center gap-2", STATE_TONE[check.state])}>
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="text-foreground">{t(`checks.${check.key}`)}</span>
                <span className="text-xs">· {t(`states.${check.state}`)}</span>
              </span>
              {editable && (
                <ReadinessActions childId={childId} check={check.key} state={check.state} itemIds={itemIdsFor(check.key)} />
              )}
            </li>
          );
        })}
      </ul>
      {showEnrichment && (
        <div className="mt-4 border-t pt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t("enrichment")}</span>
            <span>{rich.percent}%</span>
          </div>
          <Progress value={rich.percent} className="mt-1.5 h-1.5" aria-label={t("enrichment")} />
          <p className="mt-1.5 text-xs text-muted-foreground">
            {t("enrichmentHint")}{" "}
            <Link href={`/app/children/${childId}/profile`} className="text-primary underline-offset-4 hover:underline">
              {t("complete")}
            </Link>
          </p>
        </div>
      )}
    </section>
  );
}
