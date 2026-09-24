import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { platformAdminService } from "@/modules/platform/application/platform-admin.service";
import { formatDate } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";
import { loadAdmin } from "../_lib/load-admin";
import { UserActions } from "./user-actions";

const FILTERS = ["all", "admins", "unverified", "demo", "deleted"] as const;

export default async function AdminUsersPage(props: PageProps<"/admin/users">) {
  const [{ actor, user: me }, sp] = await Promise.all([loadAdmin(), props.searchParams]);
  const q = typeof sp.q === "string" ? sp.q : "";
  const only = FILTERS.includes(sp.only as (typeof FILTERS)[number]) ? (sp.only as (typeof FILTERS)[number]) : "all";
  const [t, tc, locale, rows] = await Promise.all([
    getTranslations("admin.users"),
    getTranslations("common"),
    getLocale(),
    platformAdminService.listUsers(actor, { q, only: only === "all" ? undefined : only }),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/users">
        {only !== "all" && <input type="hidden" name="only" value={only} />}
        <Input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="h-11 sm:max-w-sm" />
        <Button type="submit" variant="outline" className="h-11">
          {tc("search")}
        </Button>
      </form>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filters">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "all" ? `/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/admin/users?only=${f}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              only === f ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {t(`filters.${f}`)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState icon={Users} title={t("empty")} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {rows.map((u) => (
            <li key={u.id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {u.name}
                  {u.isPlatformAdmin && <Badge>{t("badges.admin")}</Badge>}
                  {u.isDemo && <Badge variant="secondary">{t("badges.demo")}</Badge>}
                  {u.deletedAt && <Badge variant="outline">{t("badges.deleted")}</Badge>}
                  {!u.emailVerifiedAt && !u.deletedAt && <Badge variant="outline">{t("badges.unverified")}</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {u.email} · {t("since", { when: formatDate(u.createdAt, locale, "PP") })} · {u._count.guardianships}{" "}
                  {t("children")} · {u._count.institutionMembers} {t("institutions")}
                </p>
              </div>
              <UserActions
                userId={u.id}
                isSelf={u.id === me.id}
                isPlatformAdmin={u.isPlatformAdmin}
                emailVerified={Boolean(u.emailVerifiedAt)}
                deleted={Boolean(u.deletedAt)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
