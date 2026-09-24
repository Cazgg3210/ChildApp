import { getLocale, getTranslations } from "next-intl/server";
import { ScrollText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { AuditRow } from "@/components/feature/audit-row";
import { platformAdminService } from "@/modules/platform/application/platform-admin.service";
import { loadAdmin } from "../_lib/load-admin";

export default async function AdminAuditPage(props: PageProps<"/admin/audit">) {
  const [{ actor }, sp] = await Promise.all([loadAdmin(), props.searchParams]);
  const q = typeof sp.q === "string" ? sp.q : "";
  const type = typeof sp.type === "string" ? sp.type : "";
  const days = Number(sp.days) || 0;
  const [t, ta, tc, locale, rows] = await Promise.all([
    getTranslations("admin.audit"),
    getTranslations("audit.types"),
    getTranslations("common"),
    getLocale(),
    platformAdminService.listAudit(actor, { q, type: type || undefined, days: days || undefined }),
  ]);
  const types = platformAdminService.auditTypes();

  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} />
      <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]" action="/admin/audit">
        <Input name="q" defaultValue={q} placeholder={t("actorPlaceholder")} className="h-11" />
        <NativeSelect name="type" defaultValue={type} className="h-11">
          <option value="">{t("allTypes")}</option>
          {types.map((ty) => (
            <option key={ty} value={ty}>
              {ta.has(ty) ? ta(ty) : ty}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect name="days" defaultValue={String(days)} className="h-11">
          <option value="0">{t("anyTime")}</option>
          <option value="1">{t("last24h")}</option>
          <option value="7">{t("last7d")}</option>
          <option value="30">{t("last30d")}</option>
        </NativeSelect>
        <Button type="submit" variant="outline" className="h-11">
          {tc("search")}
        </Button>
      </form>
      {rows.length === 0 ? (
        <EmptyState icon={ScrollText} title={t("empty")} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card px-4">
          {rows.map((e) => (
            <AuditRow key={e.id} event={e} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}
