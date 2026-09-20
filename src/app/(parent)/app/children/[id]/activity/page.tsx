import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Eye } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { AuditRow } from "@/components/feature/audit-row";
import { auditService } from "@/modules/audit/application/audit.service";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { cn } from "@/lib/utils";
import { loadGuardianChild } from "../_lib/load-child";

export default async function ActivityPage(props: PageProps<"/app/children/[id]/activity">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { child, actor } = await loadGuardianChild(id);
  await authorizationService.assert(actor, "audit.read", id);
  const accessOnly = sp.filter !== "all";
  const [t, locale, events] = await Promise.all([
    getTranslations("audit"),
    getLocale(),
    auditService.listForChild(id, { limit: 200, accessOnly }),
  ]);
  const name = child.preferredName ?? child.firstName;
  const base = `/app/children/${id}/activity`;

  return (
    <div>
      <PageHeader title={t("title", { name })} description={t("subtitle")} />
      <nav className="mb-4 flex gap-2" aria-label="Filters">
        {(["access", "all"] as const).map((f) => {
          const active = (f === "all") === !accessOnly;
          return (
            <Link
              key={f}
              href={f === "all" ? `${base}?filter=all` : base}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium",
                active ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {t(`filters.${f}`)}
            </Link>
          );
        })}
      </nav>
      {events.length === 0 ? (
        <EmptyState icon={Eye} title={t("empty")} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card px-4">
          {events.map((e) => (
            <AuditRow key={e.id} event={e} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}
