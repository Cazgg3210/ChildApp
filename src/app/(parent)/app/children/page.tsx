import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { Progress } from "@/components/ui/progress";
import { requireUser } from "@/modules/identity/application/session";
import { childrenService } from "@/modules/children/application/children.service";
import { profileRepository } from "@/modules/profiles/infrastructure/profile.repository";
import { completeness } from "@/modules/profiles/application/profile.service";
import { ageFromBirthDate, formatRelative } from "@/shared/utils/dates";

export default async function ChildrenPage() {
  const user = await requireUser();
  const [t, tc, tp, locale, children] = await Promise.all([
    getTranslations("children"),
    getTranslations("common"),
    getTranslations("children.overview"),
    getLocale(),
    childrenService.listForGuardian(user.id),
  ]);
  const items = children.length ? await profileRepository.listActiveForChildren(children.map((c) => c.id)) : [];

  return (
    <div>
      <PageHeader
        title={t("title")}
        actions={
          <Button asChild>
            <Link href="/app/children/new">
              <Plus aria-hidden /> {t("new")}
            </Link>
          </Button>
        }
      />
      {children.length === 0 ? (
        <EmptyState
          icon={Users}
          title={t("listEmptyTitle")}
          body={t("listEmptyBody")}
          action={
            <Button asChild size="lg">
              <Link href="/app/children/new">
                <Plus aria-hidden /> {t("new")}
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {children.map((child) => {
            const age = ageFromBirthDate(child.dateOfBirth);
            const pct = completeness(items.filter((i) => i.childId === child.id)).percent;
            return (
              <li key={child.id}>
                <Link
                  href={`/app/children/${child.id}`}
                  className="group block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <Card className="transition-shadow group-hover:shadow-md">
                    <CardContent className="flex items-center gap-4 pt-6">
                      <ChildAvatar name={`${child.firstName} ${child.lastName}`} seed={child.id} size="lg" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-lg font-semibold">
                          {child.firstName} {child.lastName}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {age.years >= 2
                            ? tc("years", { count: age.years })
                            : tc("ageYearsMonths", { years: age.years, months: age.months })}{" "}
                          · {tp("lastUpdated", { when: formatRelative(child.updatedAt, locale) })}
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={pct} className="h-1.5 flex-1" aria-label={tp("completeness")} />
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                      </div>
                      <ArrowRight className="size-5 text-muted-foreground" aria-hidden />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
