import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { ageFromBirthDate } from "@/shared/utils/dates";
import { loadGuardianChild } from "./_lib/load-child";
import { ChildTabs } from "./child-tabs";

export default async function ChildLayout({ children, params }: LayoutProps<"/app/children/[id]">) {
  const { id } = await params;
  const [{ child }, t, tc, ts, locale] = await Promise.all([
    loadGuardianChild(id),
    getTranslations("nav"),
    getTranslations("common"),
    getTranslations("sharing"),
    getLocale(),
  ]);
  const age = ageFromBirthDate(child.dateOfBirth);
  const displayName = child.preferredName ?? child.firstName;
  const base = `/app/children/${id}`;

  const tabs = [
    { href: base, label: t("overview"), exact: true },
    { href: `${base}/profile`, label: t("profile") },
    { href: `${base}/network`, label: t("network") },
    { href: `${base}/activity`, label: t("activity") },
    { href: `${base}/sessions`, label: t("careSessions") },
    { href: `${base}/proposals`, label: t("proposals") },
    { href: `${base}/documents`, label: t("documents") },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center gap-4">
        <ChildAvatar name={`${child.firstName} ${child.lastName}`} seed={child.id} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold">{displayName}</h1>
          <p className="text-sm text-muted-foreground">
            {age.years >= 2
              ? tc("years", { count: age.years })
              : tc("ageYearsMonths", { years: age.years, months: age.months })}
            <span className="mx-1.5">·</span>
            <span lang={locale}>v{child.profileVersion}</span>
          </p>
        </div>
        <Button asChild className="hidden sm:inline-flex">
          <Link href={`${base}/share/new`}>
            <Share2 aria-hidden /> {ts("title")}
          </Link>
        </Button>
      </div>
      <ChildTabs tabs={tabs} />
      <div className="mt-6">{children}</div>
    </div>
  );
}
