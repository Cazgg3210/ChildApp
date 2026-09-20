import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Share2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { loadGuardianChild } from "../_lib/load-child";
import { GrantCard } from "./grant-card";

export default async function NetworkPage({ params }: PageProps<"/app/children/[id]/network">) {
  const { id } = await params;
  const { child, actor } = await loadGuardianChild(id);
  const [t, tg, locale, grants] = await Promise.all([
    getTranslations("sharing.network"),
    getTranslations("children.guardians"),
    getLocale(),
    sharingService.listForChild(actor, id),
  ]);
  const name = child.preferredName ?? child.firstName;
  const active = grants.filter((g) => g.effectiveStatus === "ACTIVE" || g.effectiveStatus === "NOT_STARTED");
  const pending = grants.filter((g) => g.effectiveStatus === "PENDING");
  const inactive = grants.filter((g) => !active.includes(g) && !pending.includes(g));

  return (
    <div>
      <PageHeader
        title={t("title")}
        description={t("subtitle", { name })}
        actions={
          <Button asChild>
            <Link href={`/app/children/${id}/share/new`}>
              <Share2 aria-hidden /> {t("cta")}
            </Link>
          </Button>
        }
      />

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t("guardiansTitle")}
        </h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {child.guardians.map((g) => (
            <li key={g.id} className="flex items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm">
              <span className="font-medium">{g.user.name}</span>
              <span className="text-muted-foreground">{g.role === "OWNER" ? tg("owner") : tg("coGuardian")}</span>
            </li>
          ))}
        </ul>
      </section>

      {grants.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("emptyTitle")}
          body={t("emptyBody", { name })}
          action={
            <Button asChild size="lg">
              <Link href={`/app/children/${id}/share/new`}>
                <Share2 aria-hidden /> {t("cta")}
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-8">
          {[
            { key: "active", list: active },
            { key: "pending", list: pending },
            { key: "inactive", list: inactive },
          ]
            .filter((g) => g.list.length > 0)
            .map((group) => (
              <section key={group.key}>
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {t(group.key as "active" | "pending" | "inactive")}
                </h2>
                <ul className="grid gap-3 md:grid-cols-2">
                  {group.list.map((g) => (
                    <li key={g.id}>
                      <GrantCard
                        childId={id}
                        locale={locale}
                        grant={{
                          id: g.id,
                          recipientName: g.recipientName,
                          recipientKind: g.recipientKind,
                          effectiveStatus: g.effectiveStatus,
                          dataCategories: g.dataCategories,
                          startsAt: g.startsAt,
                          expiresAt: g.expiresAt,
                          hasLink: Boolean(g.shareLink),
                          hasPin: Boolean(g.shareLink?.pinHash),
                          useCount: g.shareLink?.useCount ?? 0,
                          lastUsedAt: g.shareLink?.lastUsedAt ?? null,
                          lastAcknowledgedAt: g.lastAcknowledgement?.acknowledgedAt ?? null,
                          note: g.note,
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
