import { useTranslations } from "next-intl";
import { AlertTriangle, BadgeCheck, CircleDot, FileCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const criticalityStyles = {
  CRITICAL: "bg-critical text-critical-foreground",
  IMPORTANT: "bg-important-soft text-important-foreground border border-important/30",
  INFORMATIONAL: "bg-muted text-muted-foreground",
} as const;

export function CriticalityBadge({ value, className }: { value: keyof typeof criticalityStyles; className?: string }) {
  const t = useTranslations("profile.criticality");
  const Icon = value === "CRITICAL" ? AlertTriangle : value === "IMPORTANT" ? CircleDot : Info;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        criticalityStyles[value],
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {t(value)}
    </span>
  );
}

const provenanceIcons = {
  SELF_DECLARED: CircleDot,
  OBSERVED: Info,
  DOCUMENTED: FileCheck,
  VERIFIED: BadgeCheck,
} as const;

export function ProvenanceBadge({
  status,
  sourceType,
  sourceLabel,
  className,
}: {
  status: keyof typeof provenanceIcons;
  sourceType?: string | null;
  sourceLabel?: string | null;
  className?: string;
}) {
  const t = useTranslations("profile.provenance");
  const Icon = provenanceIcons[status];
  const source =
    sourceLabel || (sourceType && t.has(`sourceType.${sourceType}`) ? t(`sourceType.${sourceType}`) : null);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] text-muted-foreground",
        status === "VERIFIED" && "text-success",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {t(status)}
      {source ? ` · ${source}` : ""}
    </span>
  );
}

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: "active" | "pending" | "inactive" | "critical";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    active: "bg-success-soft text-success",
    pending: "bg-important-soft text-important-foreground",
    inactive: "bg-muted text-muted-foreground",
    critical: "bg-critical-soft text-critical",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
