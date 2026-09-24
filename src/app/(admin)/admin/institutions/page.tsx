import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { VerificationBadge } from "@/components/feature/verification-badge";
import { platformAdminService } from "@/modules/platform/application/platform-admin.service";
import { formatDate } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";
import { loadAdmin } from "../_lib/load-admin";
import { InstitutionVerificationActions } from "./institution-actions";

const STATUSES = ["ALL", "VERIFICATION_PENDING", "VERIFIED", "UNVERIFIED", "SUSPENDED"] as const;

export default async function AdminInstitutionsPage(props: PageProps<"/admin/institutions">) {
  const [{ actor }, sp] = await Promise.all([loadAdmin(), props.searchParams]);
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = STATUSES.includes(sp.status as (typeof STATUSES)[number]) ? (sp.status as (typeof STATUSES)[number]) : "ALL";
  const [t, tv, tc, ti, locale, rows] = await Promise.all([
    getTranslations("admin.institutions"),
    getTranslations("institution.verification.status"),
    getTranslations("common"),
    getTranslations("institution.create.types"),
    getLocale(),
    platformAdminService.listInstitutions(actor, { q, status: status === "ALL" ? undefined : status }),
  ]);

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <form className="mb-4 flex flex-col gap-2 sm:flex-row" action="/admin/institutions">
        {status !== "ALL" && <input type="hidden" name="status" value={status} />}
        <Input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="h-11 sm:max-w-sm" />
        <Button type="submit" variant="outline" className="h-11">
          {tc("search")}
        </Button>
      </form>
      <nav className="mb-4 flex flex-wrap gap-2" aria-label="Filters">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "ALL" ? `/admin/institutions${q ? `?q=${encodeURIComponent(q)}` : ""}` : `/admin/institutions?status=${s}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              status === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            {s === "ALL" ? tc("viewAll") : tv(s)}
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <EmptyState icon={Building2} title={t("empty")} />
      ) : (
        <ul className="space-y-3">
          {rows.map((i) => (
            <li key={i.id} className="rounded-2xl border bg-card p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {i.name} <VerificationBadge status={i.verificationStatus} />
                    <span className="text-xs font-normal text-muted-foreground">{ti(i.type)}</span>
                  </p>
                  <dl className="grid gap-x-6 gap-y-0.5 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      <dt className="inline font-medium">{t("fields.legalName")}: </dt>
                      <dd className="inline">{i.legalName ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">{t("fields.contact")}: </dt>
                      <dd className="inline">
                        {i.contactName ?? "—"} {i.phone ? `· ${i.phone}` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">{t("fields.address")}: </dt>
                      <dd className="inline">{i.address ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">{t("fields.website")}: </dt>
                      <dd className="inline">{i.website ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">{t("fields.createdBy")}: </dt>
                      <dd className="inline">
                        {i.createdBy.name} ({i.createdBy.email}) · {formatDate(i.createdAt, locale, "PP")}
                      </dd>
                    </div>
                    <div>
                      <dt className="inline font-medium">{t("fields.code")}: </dt>
                      <dd className="inline font-mono">{i.inviteCode}</dd>
                    </div>
                  </dl>
                  <p className="text-xs text-muted-foreground">
                    {i._count.members} {t("members")} · {i._count.children} {t("children")} · {i._count.groups} {t("rooms")}
                    {i.verifiedAt ? ` · ${t("verifiedAt", { when: formatDate(i.verifiedAt, locale, "PP") })}` : ""}
                  </p>
                </div>
                <InstitutionVerificationActions institutionId={i.id} status={i.verificationStatus} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
