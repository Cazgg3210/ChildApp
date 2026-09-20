import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/feature/page-header";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { cn } from "@/lib/utils";
import { loadInstitution } from "../_lib/load-institution";
import { ChildrenTable } from "./children-table";

const FILTERS = ["all", "allergies", "updated", "new", "expiring"] as const;
type Filter = (typeof FILTERS)[number];

export default async function InstitutionChildrenPage(props: PageProps<"/institution/[institutionId]/children">) {
  const [{ institutionId }, sp] = await Promise.all([props.params, props.searchParams]);
  const { actor } = await loadInstitution(institutionId);
  const [t, locale, rows] = await Promise.all([
    getTranslations("institution.children"),
    getLocale(),
    institutionService.listChildren(actor, institutionId),
  ]);
  const filter: Filter = FILTERS.includes(sp.filter as Filter) ? (sp.filter as Filter) : "all";
  const filtered = rows.filter((r) => {
    switch (filter) {
      case "allergies":
        return r.criticalAllergies.length > 0;
      case "updated":
        return r.updatedRecently;
      case "new":
        return r.isNew;
      case "expiring":
        return r.expiringSoon;
      default:
        return true;
    }
  });

  return (
    <div>
      <PageHeader title={t("title")} />
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filters">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={
              f === "all"
                ? `/institution/${institutionId}/children`
                : `/institution/${institutionId}/children?filter=${f}`
            }
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
            aria-current={filter === f ? "page" : undefined}
          >
            {t(`filters.${f}`)}
          </Link>
        ))}
      </nav>
      <ChildrenTable institutionId={institutionId} rows={filtered} locale={locale} />
    </div>
  );
}
