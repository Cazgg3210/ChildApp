import { getLocale, getTranslations } from "next-intl/server";
import { FileCheck2 } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { StatusPill } from "@/components/feature/badges";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { formatRelative } from "@/shared/utils/dates";
import { loadGuardianChild } from "../_lib/load-child";
import { ProposalReview } from "./proposal-review";

export default async function ChildProposalsPage({ params }: PageProps<"/app/children/[id]/proposals">) {
  const { id } = await params;
  const { child, actor } = await loadGuardianChild(id);
  const [t, tp, ti, locale, proposals] = await Promise.all([
    getTranslations("proposals"),
    getTranslations("profile"),
    getTranslations("institution.proposals"),
    getLocale(),
    institutionService.listProposalsForChild(actor, id),
  ]);
  const name = child.preferredName ?? child.firstName;
  const pending = proposals.filter((p) => p.status === "PROPOSED");
  const reviewed = proposals.filter((p) => p.status !== "PROPOSED");

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      {proposals.length === 0 ? (
        <EmptyState icon={FileCheck2} title={t("empty")} />
      ) : (
        <div className="space-y-8">
          {pending.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("pending")}
              </h2>
              <ul className="space-y-3">
                {pending.map((p) => (
                  <li key={p.id} className="rounded-2xl border border-important/40 bg-important-soft/40 p-4">
                    <p className="text-sm font-medium">
                      {t("from", { institution: p.institution?.name ?? p.proposedBy.name })}
                    </p>
                    <p className="mt-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                      {tp(`sections.${p.section}.name`)} ·{" "}
                      {tp.has(`itemTypes.${p.itemType}`) ? tp(`itemTypes.${p.itemType}`) : p.itemType}
                    </p>
                    <p className="text-lg font-semibold">{p.label}</p>
                    {p.details && <p className="mt-1 whitespace-pre-line text-sm">{p.details}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("fromPerson", { name: p.proposedBy.name })} · {formatRelative(p.createdAt, locale)}
                    </p>
                    <p className="mt-3 text-sm font-medium">{t("question", { name })}</p>
                    <ProposalReview childId={id} proposalId={p.id} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {reviewed.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                {t("reviewed")}
              </h2>
              <ul className="space-y-2">
                {reviewed.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-4 text-sm"
                  >
                    <div className="min-w-0">
                      <p className="font-medium">{p.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.institution?.name ?? p.proposedBy.name} · {p.reviewedBy?.name} ·{" "}
                        {formatRelative(p.reviewedAt ?? p.createdAt, locale)}
                      </p>
                    </div>
                    <StatusPill tone={p.status === "ACCEPTED" ? "active" : "inactive"}>
                      {ti(`status.${p.status}`)}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
