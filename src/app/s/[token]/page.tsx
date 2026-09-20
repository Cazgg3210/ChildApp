import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, ArrowRight, Check, ClipboardList, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { ProfileItemCard } from "@/components/feature/profile-item-card";
import { carePassViewerState, resolveCarePass } from "@/modules/care/presentation/care-pass-context";
import { categoryOf } from "@/modules/profiles/domain/catalog";
import { CRITICAL_CATEGORIES, type DataCategory } from "@/shared/domain/care-vocabulary";
import { ageFromBirthDate, formatDateTime, formatRelative } from "@/shared/utils/dates";
import { DeniedView } from "./denied-view";
import { PinForm } from "./pin-form";
import { AcknowledgeForm } from "./acknowledge-form";
import { CarePassOpener } from "./care-pass-opener";

const SECTION_ORDER: DataCategory[] = [
  "NUTRITION",
  "SLEEP",
  "BATHROOM",
  "COMFORT",
  "COMMUNICATION",
  "HEALTH",
  "PLAY",
  "SOCIAL",
];

export default async function CarePassPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  const ctx = await resolveCarePass(token);
  const [t, tc, ts, locale] = await Promise.all([
    getTranslations("care"),
    getTranslations("common"),
    getTranslations("sharing"),
    getLocale(),
  ]);

  if (ctx.state === "denied") return <DeniedView reason={ctx.reason} />;
  if (ctx.state === "pin_required")
    return <PinForm token={token} childName={ctx.childName} remaining={ctx.remaining} />;

  const { child, items, capabilities } = ctx;
  const { lastAck, session, changes } = await carePassViewerState(ctx);
  const name = child.preferredName ?? child.firstName;
  const age = ageFromBirthDate(child.dateOfBirth);
  const critical = items.filter(
    (i) => i.criticality === "CRITICAL" && CRITICAL_CATEGORIES.includes(categoryOf(i.section, i.itemType)),
  );
  const rest = items.filter((i) => !critical.includes(i));
  const byCategory = new Map<DataCategory, typeof items>();
  for (const item of rest) {
    const cat = categoryOf(item.section, item.itemType);
    byCategory.set(cat, [...(byCategory.get(cat) ?? []), item]);
  }
  const canAck = capabilities.includes("ACKNOWLEDGE");
  const canSession = capabilities.includes("RUN_CARE_SESSION");
  const ackIsCurrent = lastAck && lastAck.profileVersion >= child.profileVersion;

  return (
    <div className="space-y-5 pt-2">
      <CarePassOpener token={token} />

      <header className="flex items-center gap-4">
        <ChildAvatar name={`${child.firstName}`} seed={child.id} size="lg" />
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold uppercase tracking-tight">{name}</h1>
          <p className="text-sm text-muted-foreground">
            {age.years >= 2
              ? t("pass.yearsOld", { count: age.years })
              : tc("ageYearsMonths", { years: age.years, months: age.months })}
          </p>
        </div>
      </header>

      <p className="text-xs text-muted-foreground">
        {t("pass.sharedBy", { name: ctx.grantedByName })} ·{" "}
        {ctx.expiresAt ? t("pass.validUntil", { when: formatDateTime(ctx.expiresAt, locale) }) : t("pass.noExpiry")}
      </p>

      {changes && changes.changes.length > 0 && (
        <div className="rounded-2xl border border-important/40 bg-important-soft p-4" role="status">
          <p className="font-semibold">{t("pass.whatsChanged", { count: changes.changes.length })}</p>
          <ul className="mt-2 space-y-1 text-sm">
            {changes.changes.slice(0, 6).map((c, i) => (
              <li key={`${c.itemId}-${i}`} className="flex items-center gap-2">
                <span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold">
                  {t(`pass.changeLabels.${c.op}`)}
                </span>
                <span>
                  {ts(`categories.${c.category}`)} · {c.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <section aria-labelledby="important" className="rounded-3xl border-2 border-critical/50 bg-critical-soft/70 p-4">
        <h2
          id="important"
          className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-critical"
        >
          <AlertTriangle className="size-4" aria-hidden /> {t("pass.important")}
        </h2>
        {critical.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("pass.noCritical")}</p>
        ) : (
          <div className="space-y-3">
            {critical.map((item) => (
              <ProfileItemCard key={item.id} item={item} compact showProvenance={false} className="bg-background" />
            ))}
          </div>
        )}
      </section>

      {SECTION_ORDER.filter((c) => byCategory.has(c)).map((cat) => (
        <section key={cat} aria-labelledby={`cat-${cat}`}>
          <h2 id={`cat-${cat}`} className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">
            {ts(`categories.${cat}`)}
          </h2>
          <div className="space-y-2">
            {byCategory.get(cat)!.map((item) => (
              <ProfileItemCard key={item.id} item={item} compact showProvenance={false} />
            ))}
          </div>
        </section>
      ))}

      {canAck && (
        <section className="rounded-3xl border bg-card p-4">
          {ackIsCurrent ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Check className="size-4" aria-hidden />{" "}
              {t("pass.reviewed", { when: formatRelative(lastAck.acknowledgedAt, locale) })} · {lastAck.actorName}
            </p>
          ) : (
            <AcknowledgeForm token={token} childName={name} defaultName={lastAck?.actorName ?? ctx.recipientName} />
          )}
        </section>
      )}

      {canSession && (
        <Button asChild size="lg" className="h-14 w-full text-base">
          <Link href={`/s/${token}/session`}>
            <ClipboardList aria-hidden /> {session ? t("pass.continueSession") : t("pass.startSession")}{" "}
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      )}

      <p className="flex items-start gap-2 pt-2 text-xs text-muted-foreground">
        <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {t("pass.footer")}
      </p>
    </div>
  );
}
