import { useTranslations } from "next-intl";
import { Building2, Link2, ShieldAlert, UserRound } from "lucide-react";
import type { AuditEvent } from "@/generated/prisma/client";
import { formatDateTime, formatRelative } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

const CRITICAL_TYPES = new Set([
  "CRITICAL_DATA_VIEWED",
  "CRITICAL_DATA_CHANGED",
  "ACCESS_REVOKED",
  "PIN_LOCKED",
  "SHARE_LINK_DENIED",
]);

/** One line of the audit trail. Categories are translated; actor + when + what. */
export function AuditRow({
  event,
  locale,
  childName,
  showCategories = true,
}: {
  event: AuditEvent & { accessGrant?: { recipientKind: string; recipientName: string } | null };
  locale: string;
  childName?: string;
  showCategories?: boolean;
}) {
  const t = useTranslations("audit");
  const ts = useTranslations("sharing");
  const Icon =
    event.actorType === "LINK"
      ? Link2
      : event.institutionId
        ? Building2
        : CRITICAL_TYPES.has(event.type)
          ? ShieldAlert
          : UserRound;
  const typeLabel = t.has(`types.${event.type}`) ? t(`types.${event.type}`) : event.type;
  const kind = event.accessGrant?.recipientKind;
  return (
    <li className="flex gap-3 py-3">
      <span
        className={cn(
          "mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground",
          CRITICAL_TYPES.has(event.type) && "bg-critical-soft text-critical",
        )}
      >
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm">
          <span className="font-medium">{event.actorLabel}</span>
          {kind && ts.has(`kinds.${kind}`) && <span className="text-muted-foreground"> · {ts(`kinds.${kind}`)}</span>}
          {childName && <span className="text-muted-foreground"> · {childName}</span>}
        </p>
        <p className="text-sm text-muted-foreground">{typeLabel}</p>
        {showCategories && event.dataCategories.length > 0 && (
          <p className="mt-1 flex flex-wrap gap-1">
            {event.dataCategories
              .filter((c) => c !== "IDENTITY")
              .map((c) => (
                <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
                  {ts.has(`categories.${c}`) ? ts(`categories.${c}`) : c}
                </span>
              ))}
          </p>
        )}
      </div>
      <time
        dateTime={event.createdAt.toISOString()}
        title={formatDateTime(event.createdAt, locale)}
        className="shrink-0 text-xs text-muted-foreground"
      >
        {formatRelative(event.createdAt, locale)}
      </time>
    </li>
  );
}
