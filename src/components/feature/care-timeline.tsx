import { useTranslations } from "next-intl";
import {
  Activity,
  AlertOctagon,
  Bed,
  Droplets,
  MessageSquare,
  Pill,
  Play,
  Square,
  Sun,
  Toilet,
  Utensils,
  ClipboardCheck,
} from "lucide-react";
import type { CareEvent } from "@/generated/prisma/client";
import { formatTime } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

export const EVENT_ICONS = {
  SESSION_STARTED: Play,
  INFO_REVIEWED: ClipboardCheck,
  FOOD: Utensils,
  WATER: Droplets,
  BATHROOM: Toilet,
  SLEEP: Bed,
  WAKE: Sun,
  MEDICATION: Pill,
  ACTIVITY: Activity,
  NOTE: MessageSquare,
  INCIDENT: AlertOctagon,
  SESSION_ENDED: Square,
} as const;

export function CareTimeline({ events, locale }: { events: CareEvent[]; locale: string }) {
  const t = useTranslations("care.session");
  if (events.length === 0) return <p className="text-sm text-muted-foreground">{t("timelineEmpty")}</p>;
  return (
    <ol className="relative space-y-4 border-l pl-6">
      {events.map((e) => {
        const Icon = EVENT_ICONS[e.type];
        const incident = e.type === "INCIDENT";
        return (
          <li key={e.id} className="relative">
            <span
              className={cn(
                "absolute -left-[31px] top-0 inline-flex size-6 items-center justify-center rounded-full border bg-background",
                incident && "border-critical bg-critical-soft text-critical",
              )}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>
            <p className="text-xs font-mono text-muted-foreground">{formatTime(e.occurredAt, locale)}</p>
            <p className={cn("font-medium", incident && "text-critical")}>{t(`events.${e.type}`)}</p>
            {e.note && <p className="text-sm text-muted-foreground">{e.note}</p>}
          </li>
        );
      })}
    </ol>
  );
}
