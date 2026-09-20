import { getLocale, getTranslations } from "next-intl/server";
import { Inbox } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { formatRelative } from "@/shared/utils/dates";
import { loadInstitution } from "../_lib/load-institution";
import { RequestActions } from "./request-actions";

export default async function RequestsPage({ params }: PageProps<"/institution/[institutionId]/requests">) {
  const { institutionId } = await params;
  const { actor, role } = await loadInstitution(institutionId);
  const [t, ts, locale, requests] = await Promise.all([
    getTranslations("institution.requests"),
    getTranslations("sharing"),
    getLocale(),
    institutionService.listPendingRequests(actor, institutionId),
  ]);
  return (
    <div>
      <PageHeader title={t("title")} />
      {requests.length === 0 ? (
        <EmptyState icon={Inbox} title={t("empty")} />
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <ChildAvatar name={`${r.child.firstName} ${r.child.lastName}`} seed={r.child.id} />
                <div>
                  <p className="font-medium">
                    {t("body", {
                      guardian: r.accessGrant.grantedBy.name,
                      child: `${r.child.firstName} ${r.child.lastName}`,
                    })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelative(r.invitedAt, locale)} ·{" "}
                    {r.accessGrant.dataCategories
                      .filter((c) => c !== "IDENTITY")
                      .map((c) => ts(`categories.${c}`))
                      .join(", ")}
                  </p>
                </div>
              </div>
              {role === "ADMIN" && (
                <RequestActions institutionId={institutionId} relationId={r.id} childName={r.child.firstName} />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
