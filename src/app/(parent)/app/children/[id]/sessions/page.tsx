import { getLocale, getTranslations } from "next-intl/server";
import { ClipboardList } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { StatusPill } from "@/components/feature/badges";
import { CareTimeline } from "@/components/feature/care-timeline";
import { careService } from "@/modules/care/application/care.service";
import { formatDateTime } from "@/shared/utils/dates";
import { loadGuardianChild } from "../_lib/load-child";

export default async function SessionsPage({ params }: PageProps<"/app/children/[id]/sessions">) {
  const { id } = await params;
  const { actor } = await loadGuardianChild(id);
  const [t, locale, sessions] = await Promise.all([
    getTranslations("care.session"),
    getLocale(),
    careService.listSessionsForChild(actor, id),
  ]);
  return (
    <div>
      <PageHeader title={t("list")} />
      {sessions.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("listEmpty")} />
      ) : (
        <ul className="space-y-4">
          {sessions.map((s) => (
            <li key={s.id} className="rounded-2xl border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">{s.caregiverName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(s.startedAt, locale)}
                    {s.endedAt ? ` → ${formatDateTime(s.endedAt, locale)}` : ""}
                  </p>
                </div>
                <StatusPill tone={s.status === "ACTIVE" ? "active" : "inactive"}>
                  {s.status === "ACTIVE" ? t("active") : t("ended")}
                </StatusPill>
              </div>
              <CareTimeline events={s.events} locale={locale} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
