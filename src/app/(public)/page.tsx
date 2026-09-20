import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Eye, Lock, Share2, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/layout/language-switcher";

export default async function LandingPage() {
  const t = await getTranslations("landing");
  const pillars = [
    { icon: Sparkles, key: "create" as const },
    { icon: Lock, key: "control" as const },
    { icon: Share2, key: "share" as const },
  ];
  const steps = ["one", "two", "three"] as const;

  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-6xl px-4 pb-16 pt-14 sm:pt-24">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-primary">{t("eyebrow")}</p>
        <h1 className="max-w-3xl text-4xl font-semibold leading-[1.08] sm:text-5xl md:text-6xl">{t("title")}</h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{t("subtitle")}</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 px-6 text-base">
            <Link href="/register">
              {t("ctaPrimary")} <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline" className="h-12 px-6 text-base">
            <Link href="/login">{t("ctaSecondary")}</Link>
          </Button>
        </div>
        <p className="mt-6 flex items-start gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          {t("trustNote")}
        </p>
      </section>

      <section className="border-y bg-card">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-14 md:grid-cols-3">
          {pillars.map(({ icon: Icon, key }) => (
            <div key={key} className="flex gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                <Icon className="size-5" aria-hidden />
              </span>
              <div>
                <h2 className="text-lg font-semibold">{t(`pillars.${key}.title`)}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`pillars.${key}.body`)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-16">
        <h2 className="text-2xl font-semibold sm:text-3xl">{t("howTitle")}</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-3">
          {steps.map((key, i) => (
            <li key={key}>
              <Card className="h-full">
                <CardContent className="pt-6">
                  <span className="mb-3 inline-flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold">{t(`steps.${key}.title`)}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t(`steps.${key}.body`)}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-16">
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="flex flex-col gap-6 py-10 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <h2 className="text-2xl font-semibold">{t("institutionsTitle")}</h2>
              <p className="mt-2 leading-relaxed text-primary-foreground/85">{t("institutionsBody")}</p>
            </div>
            <Button asChild size="lg" variant="secondary" className="h-12 shrink-0 px-6 text-base">
              <Link href="/register?intent=institution">
                <Eye aria-hidden /> {t("institutionsCta")}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-6 text-xs text-muted-foreground">
          <span>{t("footer")}</span>
          <LanguageSwitcher />
        </div>
      </footer>
    </div>
  );
}
