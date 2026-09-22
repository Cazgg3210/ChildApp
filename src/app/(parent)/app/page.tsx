import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertCircle, ArrowRight, Building2, Clock, Mail, Plus, Users } from "lucide-react";
import { ReadinessPill } from "@/components/feature/readiness-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { EmptyState } from "@/components/feature/page-header";
import { requireUser } from "@/modules/identity/application/session";
import { childrenService } from "@/modules/children/application/children.service";
import { ageFromBirthDate, formatRelative } from "@/shared/utils/dates";
import { AuditRow } from "@/components/feature/audit-row";

export default async function DashboardPage(props: PageProps<"/app">) {
  const user = await requireUser();
  const [t, tc, locale, data, sp, invitations] = await Promise.all([
    getTranslations("dashboard"),
    getTranslations("common"),
    getLocale(),
    childrenService.dashboard(user.id),
    props.searchParams,
    childrenService.listInvitationsForUser(user.email),
  ]);
  const hour =
    Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: user.timezone }).format(new Date())) % 24;
  const period = hour < 12 ? "morning" : hour < 19 ? "afternoon" : "evening";
  const firstName = user.name.split(" ")[0];
  const childName = (id: string) => {
    const c = data.children.find((s) => s.child.id === id)?.child;
    return c ? (c.preferredName ?? c.firstName) : "";
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold sm:text-3xl">{t("greeting", { period, name: firstName })}</h1>
        {sp.welcome === "1" && <p className="mt-2 text-muted-foreground">{t("welcome")}</p>}
      </div>

      {!user.emailVerifiedAt && (
        <Alert>
          <AlertCircle />
          <AlertDescription>{t("unverifiedEmail")}</AlertDescription>
        </Alert>
      )}

      {invitations.length > 0 && (
        <Alert className="border-primary/40 bg-primary/5">
          <Mail />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t("invitations", {
                count: invitations.length,
                name: invitations[0].child.preferredName ?? invitations[0].child.firstName,
                inviter: invitations[0].invitedBy.name,
              })}
            </span>
            <Button asChild size="sm">
              <Link href="/app/invitations">{t("review")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <section aria-labelledby="children-heading">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="children-heading" className="text-lg font-semibold">
            {t("yourChildren")}
          </h2>
          {data.children.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link href="/app/children/new">
                <Plus aria-hidden /> {t("addChild")}
              </Link>
            </Button>
          )}
        </div>
        {data.children.length === 0 ? (
          <EmptyState
            icon={Users}
            title={t("emptyTitle")}
            body={t("emptyBody")}
            action={
              <Button asChild size="lg">
                <Link href="/app/children/new">
                  <Plus aria-hidden /> {t("createFirst")}
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {data.children.map(
              ({ child, activeCaregivers, connectedInstitutions, changesThisWeek, criticalChangedAt, readiness }) => {
                const age = ageFromBirthDate(child.dateOfBirth);
                return (
                  <Link
                    key={child.id}
                    href={`/app/children/${child.id}`}
                    className="group rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <Card className="h-full transition-shadow group-hover:shadow-md">
                      <CardContent className="flex gap-4 pt-6">
                        <ChildAvatar name={`${child.firstName} ${child.lastName}`} seed={child.id} size="lg" />
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                            {child.preferredName ?? child.firstName}
                            <ReadinessPill readiness={readiness} />
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {age.years >= 2
                              ? tc("years", { count: age.years })
                              : tc("ageYearsMonths", { years: age.years, months: age.months })}
                          </p>
                          <ul className="mt-3 space-y-1 text-sm">
                            <li className="flex items-center gap-2 text-muted-foreground">
                              <Users className="size-4 shrink-0" aria-hidden />{" "}
                              {t("stats.caregivers", { count: activeCaregivers })}
                            </li>
                            <li className="flex items-center gap-2 text-muted-foreground">
                              <Building2 className="size-4 shrink-0" aria-hidden />{" "}
                              {t("stats.institutions", { count: connectedInstitutions })}
                            </li>
                            <li className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="size-4 shrink-0" aria-hidden />{" "}
                              {t("stats.changes", { count: changesThisWeek })}
                            </li>
                            {criticalChangedAt && (
                              <li className="flex items-center gap-2 text-critical">
                                <AlertCircle className="size-4 shrink-0" aria-hidden />{" "}
                                {t("stats.criticalUpdated", { when: formatRelative(criticalChangedAt, locale) })}
                              </li>
                            )}
                          </ul>
                        </div>
                        <ArrowRight
                          className="size-5 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </CardContent>
                    </Card>
                  </Link>
                );
              },
            )}
          </div>
        )}
      </section>

      {data.children.length > 0 && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-base">{t("alerts")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {data.pendingProposals === 0 &&
                data.pendingInstitutions.length === 0 &&
                data.expiringGrants.length === 0 && <p className="text-muted-foreground">{t("alertsEmpty")}</p>}
              {data.children
                .filter((c) => c.pendingProposals > 0)
                .map((c) => (
                  <div key={c.child.id} className="flex items-center justify-between gap-2 rounded-xl bg-important-soft p-3">
                    <span>
                      {c.child.preferredName ?? c.child.firstName}: {t("pendingProposals", { count: c.pendingProposals })}
                    </span>
                    <Button asChild size="sm" variant="secondary">
                      <Link href={`/app/children/${c.child.id}/proposals`}>{t("review")}</Link>
                    </Button>
                  </div>
                ))}
              {data.pendingInstitutions.map((p) => (
                <div key={`${p.childId}-${p.name}`} className="rounded-xl bg-muted p-3 text-muted-foreground">
                  {childName(p.childId)}: {t("pendingInstitution", { name: p.name })}
                </div>
              ))}
              {data.expiringGrants.length > 0 && (
                <div>
                  <p className="mb-1 font-medium">{t("upcoming")}</p>
                  <ul className="space-y-1">
                    {data.expiringGrants.map((g) => (
                      <li key={g.id} className="flex items-center justify-between gap-2 text-muted-foreground">
                        <span>
                          {g.recipientName} · {childName(g.childId)}
                        </span>
                        <span className="text-xs">{t("expiresAt", { when: formatRelative(g.expiresAt, locale) })}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">{t("recentActivity")}</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentAudit.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("recentEmpty")}</p>
              ) : (
                <ul className="divide-y">
                  {data.recentAudit.map((e) => (
                    <AuditRow key={e.id} event={e} locale={locale} childName={childName(e.childId ?? "")} />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
