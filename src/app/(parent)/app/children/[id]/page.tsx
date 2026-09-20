import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Plus, Share2, ShieldAlert, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProfileItemCard } from "@/components/feature/profile-item-card";
import { EmptyState } from "@/components/feature/page-header";
import { AuditRow } from "@/components/feature/audit-row";
import { StatusPill } from "@/components/feature/badges";
import { profileService, completeness, criticalItems } from "@/modules/profiles/application/profile.service";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { SECTION_GROUPS } from "@/modules/profiles/domain/catalog";
import { formatRelative } from "@/shared/utils/dates";
import { loadGuardianChild } from "./_lib/load-child";

export default async function ChildOverviewPage({ params }: PageProps<"/app/children/[id]">) {
  const { id } = await params;
  const { child, actor } = await loadGuardianChild(id);
  const [t, ts, tp, tn, locale, items, grants, audit] = await Promise.all([
    getTranslations("children.overview"),
    getTranslations("sharing"),
    getTranslations("profile"),
    getTranslations("nav"),
    getLocale(),
    profileService.listItems(actor, id),
    sharingService.listForChild(actor, id),
    auditService.listForChild(id, { limit: 6 }),
  ]);
  const base = `/app/children/${id}`;
  const critical = criticalItems(items);
  const done = completeness(items);
  const activeGrants = grants.filter((g) => g.effectiveStatus === "ACTIVE" || g.effectiveStatus === "PENDING");
  const displayName = child.preferredName ?? child.firstName;

  return (
    <div className="grid gap-6 xl:grid-cols-3">
      <div className="space-y-6 xl:col-span-2">
        <section aria-labelledby="critical-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="critical-heading" className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="size-5 text-critical" aria-hidden /> {t("critical")}
            </h2>
            <Button asChild variant="outline" size="sm">
              <Link href={`${base}/profile/health`}>
                <Plus aria-hidden /> {t("addCritical")}
              </Link>
            </Button>
          </div>
          {critical.length === 0 ? (
            <EmptyState
              icon={ShieldAlert}
              title={t("criticalEmpty")}
              action={
                <Button asChild>
                  <Link href={`${base}/profile/health`}>{t("addCritical")}</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {critical.map((item) => (
                <ProfileItemCard key={item.id} item={item} compact showProvenance={false} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="sections-heading">
          <div className="mb-3 flex items-center justify-between">
            <h2 id="sections-heading" className="text-lg font-semibold">
              {t("sections")}
            </h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Progress value={done.percent} className="h-1.5 w-24" aria-label={t("completeness")} />
              {done.percent}%
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {Object.entries(SECTION_GROUPS).map(([group, sections]) => {
              const count = items.filter((i) => (sections as readonly string[]).includes(i.section)).length;
              return (
                <li key={group}>
                  <Link
                    href={`${base}/profile/${group}`}
                    className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="font-medium">{tp(`groups.${group}`)}</span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {count > 0 ? (
                        <StatusPill tone="active">{count}</StatusPill>
                      ) : (
                        <StatusPill tone="inactive">0</StatusPill>
                      )}
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("network")}</CardTitle>
            <Button asChild size="sm">
              <Link href={`${base}/share/new`}>
                <Share2 aria-hidden /> {t("shareCare")}
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activeGrants.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("networkEmpty")}</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {activeGrants.slice(0, 5).map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      <Users className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate font-medium">{g.recipientName}</span>
                      <span className="text-muted-foreground">· {ts(`kinds.${g.recipientKind}`)}</span>
                    </span>
                    <StatusPill tone={g.effectiveStatus === "ACTIVE" ? "active" : "pending"}>
                      {ts(`status.${g.effectiveStatus}`)}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-2 px-0">
              <Link href={`${base}/network`}>{tn("network")} →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("activity")}</CardTitle>
          </CardHeader>
          <CardContent>
            {audit.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("lastUpdated", { when: formatRelative(child.updatedAt, locale) })}
              </p>
            ) : (
              <ul className="divide-y">
                {audit.map((e) => (
                  <AuditRow key={e.id} event={e} locale={locale} showCategories={false} />
                ))}
              </ul>
            )}
            <Button asChild variant="link" className="mt-2 px-0">
              <Link href={`${base}/activity`}>{tn("activity")} →</Link>
            </Button>
          </CardContent>
        </Card>
        <p className="text-xs text-muted-foreground">
          {displayName} · {tp("version", { version: child.profileVersion })}
        </p>
      </div>
    </div>
  );
}
