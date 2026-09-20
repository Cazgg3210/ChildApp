import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { carePassViewerState, resolveCarePass } from "@/modules/care/presentation/care-pass-context";
import { CareTimeline } from "@/components/feature/care-timeline";
import { DeniedView } from "../denied-view";
import { PinForm } from "../pin-form";
import { StartSessionForm } from "./start-session-form";
import { SessionControls } from "./session-controls";

export default async function CareSessionPage({ params }: PageProps<"/s/[token]/session">) {
  const { token } = await params;
  const ctx = await resolveCarePass(token);
  const [t, locale] = await Promise.all([getTranslations("care.session"), getLocale()]);
  if (ctx.state === "denied") return <DeniedView reason={ctx.reason} />;
  if (ctx.state === "pin_required")
    return <PinForm token={token} childName={ctx.childName} remaining={ctx.remaining} />;
  if (!ctx.capabilities.includes("RUN_CARE_SESSION")) return <DeniedView reason="CAPABILITY_MISSING" />;

  const { session, lastAck } = await carePassViewerState(ctx);
  const name = ctx.child.preferredName ?? ctx.child.firstName;

  return (
    <div className="space-y-5 pt-2">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link href={`/s/${token}`}>
          <ArrowLeft aria-hidden /> {t("backToPass")}
        </Link>
      </Button>
      <h1 className="text-2xl font-semibold">{t("title")}</h1>

      {!session ? (
        <StartSessionForm token={token} childName={name} defaultName={lastAck?.actorName ?? ctx.recipientName} />
      ) : (
        <>
          <dl className="grid grid-cols-2 gap-2 rounded-2xl border bg-card p-4 text-sm">
            <dt className="text-muted-foreground">{t("child")}</dt>
            <dd className="font-medium">{name}</dd>
            <dt className="text-muted-foreground">{t("caregiver")}</dt>
            <dd className="font-medium">{session.caregiverName}</dd>
            <dt className="text-muted-foreground">{t("start")}</dt>
            <dd className="font-medium">
              {session.startedAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
            </dd>
            {session.expectedEndAt && (
              <>
                <dt className="text-muted-foreground">{t("expectedEnd")}</dt>
                <dd className="font-medium">
                  {session.expectedEndAt.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                </dd>
              </>
            )}
          </dl>
          <SessionControls token={token} sessionId={session.id} />
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">{t("timeline")}</h2>
            <CareTimeline events={session.events} locale={locale} />
          </section>
        </>
      )}
    </div>
  );
}
