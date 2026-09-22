import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { ProfileItemCard } from "@/components/feature/profile-item-card";
import { StatusPill } from "@/components/feature/badges";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { partitionForCarePass } from "@/modules/profiles/domain/care-pass-layout";
import { AppError } from "@/shared/errors/app-error";
import { getRequestMeta } from "@/shared/security/request-context";
import { ageFromBirthDate, formatDate, formatRelative } from "@/shared/utils/dates";
import { loadInstitution } from "../../_lib/load-institution";
import { AcknowledgeButton } from "./acknowledge-button";
import { ProposeDialog } from "./propose-dialog";

export default async function InstitutionChildPage({
  params,
}: PageProps<"/institution/[institutionId]/children/[childId]">) {
  const { institutionId, childId } = await params;
  const { actor, user } = await loadInstitution(institutionId);
  let data: Awaited<ReturnType<typeof institutionService.getChild>>;
  try {
    data = await institutionService.getChild(actor, institutionId, childId, await getRequestMeta());
  } catch (err) {
    if (AppError.is(err)) notFound();
    throw err;
  }
  const [t, ts, tc, tp, locale] = await Promise.all([
    getTranslations("institution"),
    getTranslations("sharing"),
    getTranslations("common"),
    getTranslations("institution.proposals"),
    getLocale(),
  ]);
  const { child, grant, items, capabilities, acknowledgements, proposals, lastUpdated } = data;
  const name = child.preferredName ?? child.firstName;
  const age = ageFromBirthDate(child.dateOfBirth);
  const { highlighted: critical, groups } = partitionForCarePass(items);
  const myAck = acknowledgements.find((a) => a.actorUserId === user.id && a.profileVersion >= child.profileVersion);

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <header className="flex items-center gap-4">
          <ChildAvatar name={`${child.firstName} ${child.lastName}`} seed={child.id} size="lg" />
          <div>
            <h1 className="text-2xl font-semibold">
              {child.firstName} {child.lastName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {age.years >= 2
                ? tc("years", { count: age.years })
                : tc("ageYearsMonths", { years: age.years, months: age.months })}
            </p>
          </div>
        </header>

        <section className="rounded-3xl border-2 border-critical/50 bg-critical-soft/70 p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-critical">
            <AlertTriangle className="size-4" aria-hidden /> {ts("categories.EMERGENCY")} · {ts("categories.ALLERGIES")}{" "}
            · {ts("categories.MEDICATION")}
          </h2>
          {critical.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {critical.map((item) => (
                <ProfileItemCard key={item.id} item={item} compact className="bg-background" />
              ))}
            </div>
          )}
        </section>

        {groups.map(({ category: cat, items: groupItems }) => (
          <section key={cat}>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
              {ts(`categories.${cat}`)}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {groupItems.map((item) => (
                <ProfileItemCard key={item.id} item={item} compact />
              ))}
            </div>
          </section>
        ))}
      </div>

      <aside className="space-y-4">
        <Card>
          <CardContent className="space-y-2 pt-6 text-sm">
            <p>
              <span className="text-muted-foreground">{t("child.sharedBy")}:</span>{" "}
              <span className="font-medium">{grant.grantedBy.name}</span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("child.validUntil")}:</span>{" "}
              <span className="font-medium">
                {grant.expiresAt ? formatDate(grant.expiresAt, locale, "PPP") : ts("grant.noExpiry")}
              </span>
            </p>
            <p>
              <span className="text-muted-foreground">{t("child.lastUpdated")}:</span>{" "}
              <span className="font-medium">{formatRelative(lastUpdated, locale)}</span>
            </p>
            <p className="flex flex-wrap gap-1 pt-1">
              {data.categories
                .filter((c) => c !== "IDENTITY")
                .map((c) => (
                  <span key={c} className="rounded-full bg-secondary px-2 py-0.5 text-[11px]">
                    {ts(`categories.${c}`)}
                  </span>
                ))}
            </p>
          </CardContent>
        </Card>

        {capabilities.includes("ACKNOWLEDGE") && (
          <Card>
            <CardContent className="pt-6">
              {myAck ? (
                <p className="flex items-center gap-2 text-sm text-success">
                  <Check className="size-4" aria-hidden />{" "}
                  {t("child.acknowledgedBy", {
                    name: myAck.actorName,
                    when: formatRelative(myAck.acknowledgedAt, locale),
                  })}
                </p>
              ) : (
                <AcknowledgeButton
                  institutionId={institutionId}
                  childId={childId}
                  label={t("child.acknowledge", { name })}
                />
              )}
              {acknowledgements.length > 0 && (
                <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                  {acknowledgements.slice(0, 3).map((a) => (
                    <li key={a.id}>
                      {a.actorName} · v{a.profileVersion} · {formatRelative(a.acknowledgedAt, locale)}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {capabilities.includes("PROPOSE_CHANGES") && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("child.proposals")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ProposeDialog institutionId={institutionId} childId={childId} childName={name} />
              {proposals.length > 0 && (
                <ul className="space-y-2 text-sm">
                  {proposals.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.proposedBy.name} · {formatRelative(p.createdAt, locale)}
                        </span>
                      </span>
                      <StatusPill
                        tone={p.status === "ACCEPTED" ? "active" : p.status === "REJECTED" ? "inactive" : "pending"}
                      >
                        {tp(`status.${p.status}`)}
                      </StatusPill>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}
      </aside>
    </div>
  );
}
