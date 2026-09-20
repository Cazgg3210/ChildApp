import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { FileCheck2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { StatusPill } from "@/components/feature/badges";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { formatRelative } from "@/shared/utils/dates";
import { loadInstitution } from "../_lib/load-institution";

export default async function InstitutionProposalsPage({
  params,
}: PageProps<"/institution/[institutionId]/proposals">) {
  const { institutionId } = await params;
  const { actor } = await loadInstitution(institutionId);
  const [t, tp, locale, proposals] = await Promise.all([
    getTranslations("institution.proposals"),
    getTranslations("profile"),
    getLocale(),
    institutionService.listProposalsForInstitution(actor, institutionId),
  ]);
  return (
    <div>
      <PageHeader title={t("title")} />
      {proposals.length === 0 ? (
        <EmptyState icon={FileCheck2} title={t("empty")} />
      ) : (
        <ul className="space-y-3">
          {proposals.map((p) => (
            <li key={p.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    <Link href={`/institution/${institutionId}/children/${p.child.id}`} className="hover:underline">
                      {p.child.preferredName ?? p.child.firstName}
                    </Link>{" "}
                    · {tp(`sections.${p.section}.name`)}
                  </p>
                  <p className="font-semibold">{p.label}</p>
                  {p.details && <p className="mt-1 text-sm text-muted-foreground">{p.details}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">
                    {p.proposedBy.name} · {formatRelative(p.createdAt, locale)}
                    {p.reviewNote ? ` · ${p.reviewNote}` : ""}
                  </p>
                </div>
                <StatusPill
                  tone={p.status === "ACCEPTED" ? "active" : p.status === "REJECTED" ? "inactive" : "pending"}
                >
                  {t(`status.${p.status}`)}
                </StatusPill>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
