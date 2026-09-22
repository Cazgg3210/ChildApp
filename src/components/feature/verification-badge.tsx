import { useTranslations } from "next-intl";
import { BadgeCheck, Clock, ShieldOff, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";

export type VerificationStatus = "UNVERIFIED" | "VERIFICATION_PENDING" | "VERIFIED" | "SUSPENDED";

const STYLES: Record<VerificationStatus, { icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  VERIFIED: { icon: BadgeCheck, tone: "bg-success-soft text-success" },
  VERIFICATION_PENDING: { icon: Clock, tone: "bg-important-soft text-important-foreground" },
  UNVERIFIED: { icon: ShieldQuestion, tone: "bg-muted text-muted-foreground" },
  SUSPENDED: { icon: ShieldOff, tone: "bg-critical-soft text-critical" },
};

/** Institution verification status, shown wherever a family decides whether to trust an institution. */
export function VerificationBadge({ status, className }: { status: VerificationStatus; className?: string }) {
  const t = useTranslations("institution.verification.status");
  const { icon: Icon, tone } = STYLES[status];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold", tone, className)}>
      <Icon className="size-3" aria-hidden />
      {t(status)}
    </span>
  );
}
