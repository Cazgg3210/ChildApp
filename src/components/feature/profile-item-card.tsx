import { useTranslations } from "next-intl";
import { CheckCircle2, Phone } from "lucide-react";
import { isDeclaration } from "@/modules/profiles/domain/catalog";
import type { ProfileItem } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";
import { CriticalityBadge, ProvenanceBadge } from "./badges";

const toneByCriticality = {
  CRITICAL: "border-critical/40 bg-critical-soft/60",
  IMPORTANT: "border-important/30 bg-important-soft/50",
  INFORMATIONAL: "bg-card",
} as const;

export function itemData(item: Pick<ProfileItem, "data">): Record<string, string> {
  const d = item.data;
  if (!d || typeof d !== "object" || Array.isArray(d)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(d as Record<string, unknown>))
    if (v !== null && v !== undefined && v !== "") out[k] = String(v);
  return out;
}

/** Renders a single care fact with its criticality and provenance. Shared by guardian, caregiver and institution views. */
export function ProfileItemCard({
  item,
  actions,
  compact = false,
  showProvenance = true,
  className,
}: {
  item: ProfileItem;
  actions?: React.ReactNode;
  compact?: boolean;
  showProvenance?: boolean;
  className?: string;
}) {
  const t = useTranslations("profile");
  const data = itemData(item);
  const phone = data.phone;
  const typeLabel = t.has(`itemTypes.${item.itemType}`) ? t(`itemTypes.${item.itemType}`) : item.itemType;

  // Explicit "none declared" facts read as a confirmation, not as a data row.
  if (isDeclaration(item.itemType)) {
    return (
      <article className={cn("flex items-center justify-between gap-3 rounded-2xl border border-success/40 bg-success-soft/50 p-4", className)}>
        <div className="flex items-center gap-3">
          <CheckCircle2 className="size-5 shrink-0 text-success" aria-hidden />
          <div>
            <h4 className="font-semibold leading-snug">{typeLabel}</h4>
            {showProvenance && (
              <p className="text-xs text-muted-foreground">
                {t("readiness.declaredBy", { when: new Date(item.updatedAt).toLocaleDateString() })}
              </p>
            )}
          </div>
        </div>
        {actions}
      </article>
    );
  }

  return (
    <article className={cn("rounded-2xl border p-4", toneByCriticality[item.criticality], className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{typeLabel}</p>
          <h4 className={cn("font-semibold leading-snug", compact ? "text-base" : "text-lg")}>{item.label}</h4>
          {item.details && (
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/85">{item.details}</p>
          )}
          {Object.keys(data).length > 0 && (
            <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              {Object.entries(data).map(([k, v]) => (
                <div key={k} className="flex items-baseline gap-1">
                  <dt className="text-xs text-muted-foreground">{t.has(`fields.${k}`) ? t(`fields.${k}`) : k}:</dt>
                  <dd className="font-medium">{k === "severity" && t.has(`fields.${v}`) ? t(`fields.${v}`) : v}</dd>
                </div>
              ))}
            </dl>
          )}
          {phone && (
            <a
              href={`tel:${phone.replace(/\s+/g, "")}`}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground tap-target"
            >
              <Phone className="size-4" aria-hidden /> {phone}
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {item.criticality !== "INFORMATIONAL" && <CriticalityBadge value={item.criticality} />}
          {actions}
        </div>
      </div>
      {showProvenance && (
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
          <ProvenanceBadge status={item.provenance} sourceType={item.sourceType} sourceLabel={item.sourceLabel} />
        </div>
      )}
    </article>
  );
}
