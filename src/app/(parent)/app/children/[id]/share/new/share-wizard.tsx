"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { addDays, addHours, addMonths, addYears, setHours, setMinutes } from "date-fns";
import { Building2, Check, Loader2, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  createCareShareAction,
  lookupInstitutionAction,
  type ShareResult,
} from "@/modules/sharing/presentation/actions";
import {
  CAPABILITIES,
  DEFAULT_CAPABILITIES,
  DEFAULT_CATEGORIES,
  RECIPIENT_KINDS,
  SHAREABLE_CATEGORIES,
  type Capability,
  type DataCategory,
  type RecipientKindValue,
} from "@/shared/domain/care-vocabulary";
import { formatDateTime, toDateTimeLocalValue } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";
import { ShareResultView } from "@/components/feature/share-result";

type Preset = "hours4" | "tonight" | "days7" | "months6" | "year1" | "custom" | "none";

const STEPS = ["stepWho", "stepWhat", "stepWhen", "stepPreview"] as const;

export function ShareWizard({ childId, childName }: { childId: string; childName: string }) {
  const t = useTranslations("sharing");
  const tc = useTranslations("common");
  const locale = useLocale();
  const [step, setStep] = useState(0);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ShareResult | null>(null);

  const [kind, setKind] = useState<RecipientKindValue>("BABYSITTER");
  const [recipientName, setRecipientName] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [institutionCode, setInstitutionCode] = useState("");
  const [institution, setInstitution] = useState<{ id: string; name: string } | null | undefined>(undefined);
  const [categories, setCategories] = useState<Set<DataCategory>>(new Set(DEFAULT_CATEGORIES.BABYSITTER));
  const [capabilities, setCapabilities] = useState<Set<Capability>>(new Set(DEFAULT_CAPABILITIES.BABYSITTER));
  const [preset, setPreset] = useState<Preset>("hours4");
  const [startsAt, setStartsAt] = useState(toDateTimeLocalValue(new Date()));
  const [expiresAt, setExpiresAt] = useState(toDateTimeLocalValue(addHours(new Date(), 4)));
  const [pin, setPin] = useState("");
  const [singleUse, setSingleUse] = useState(false);
  const [note, setNote] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const isInstitution = kind === "INSTITUTION";
  const displayName = isInstitution ? (institution?.name ?? recipientName) : recipientName;

  const chooseKind = (k: RecipientKindValue) => {
    setKind(k);
    setCategories(new Set(DEFAULT_CATEGORIES[k]));
    setCapabilities(new Set(DEFAULT_CAPABILITIES[k]));
    if (k === "INSTITUTION" || k === "FAMILY") applyPreset(k === "INSTITUTION" ? "year1" : "months6");
    else applyPreset("hours4");
  };

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const now = new Date();
    setStartsAt(toDateTimeLocalValue(now));
    switch (p) {
      case "hours4":
        setExpiresAt(toDateTimeLocalValue(addHours(now, 4)));
        break;
      case "tonight":
        setExpiresAt(toDateTimeLocalValue(setMinutes(setHours(addDays(now, 1), 1), 0)));
        break;
      case "days7":
        setExpiresAt(toDateTimeLocalValue(addDays(now, 7)));
        break;
      case "months6":
        setExpiresAt(toDateTimeLocalValue(addMonths(now, 6)));
        break;
      case "year1":
        setExpiresAt(toDateTimeLocalValue(addYears(now, 1)));
        break;
      case "none":
        setExpiresAt("");
        break;
      default:
        break;
    }
  };

  const lookup = () =>
    start(async () => {
      const res = await lookupInstitutionAction(institutionCode);
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      setInstitution(res.data ?? null);
    });

  const toggle = <T,>(set: Set<T>, value: T, update: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    update(next);
  };

  const whoValid = isInstitution ? Boolean(institution) : recipientName.trim().length > 0;
  const whenValid = !expiresAt || new Date(expiresAt) > new Date(startsAt);
  const notShared = useMemo(() => SHAREABLE_CATEGORIES.filter((c) => !categories.has(c)), [categories]);

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await createCareShareAction(childId, {
        recipientKind: kind,
        recipientName: recipientName.trim() || institution?.name || "",
        recipientEmail: recipientEmail.trim() || null,
        institutionCode: isInstitution ? institutionCode.trim().toUpperCase() : null,
        dataCategories: [...categories],
        capabilities: [...capabilities],
        startsAt: new Date(startsAt),
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        pin: pin || null,
        singleUse,
        note: note.trim() || null,
      });
      if (res.ok && res.data) setResult(res.data);
      else if (!res.ok) setError(res.message);
    });

  if (result) {
    return <ShareResultView result={result} childId={childId} childName={childName} />;
  }

  return (
    <div className="space-y-6">
      <ol className="flex items-center gap-2" aria-label="Steps">
        {STEPS.map((s, i) => (
          <li key={s} className="flex flex-1 flex-col gap-1.5">
            <span className={cn("h-1.5 rounded-full", i <= step ? "bg-primary" : "bg-muted")} />
            <span
              className={cn(
                "hidden text-[11px] font-medium sm:block",
                i === step ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t(`wizard.${s}`)}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {step === 0 && (
            <>
              <h2 className="text-xl font-semibold">{t("wizard.stepWho")}</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {RECIPIENT_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => chooseKind(k)}
                    aria-pressed={kind === k}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-2xl border p-4 text-left transition-colors tap-target",
                      kind === k ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-muted",
                    )}
                  >
                    <span className="flex items-center gap-2 font-semibold">
                      {k === "INSTITUTION" ? (
                        <Building2 className="size-4" aria-hidden />
                      ) : (
                        <Users className="size-4" aria-hidden />
                      )}
                      {t(`kinds.${k}`)}
                    </span>
                    <span className="text-sm text-muted-foreground">{t(`kinds.descriptions.${k}`)}</span>
                  </button>
                ))}
              </div>
              {isInstitution ? (
                <div className="space-y-1.5">
                  <Label htmlFor="code">{t("wizard.institutionCode")}</Label>
                  <div className="flex gap-2">
                    <Input
                      id="code"
                      value={institutionCode}
                      onChange={(e) => {
                        setInstitutionCode(e.target.value.toUpperCase());
                        setInstitution(undefined);
                      }}
                      placeholder="ARC-7K3P9Q"
                      className="h-11 font-mono uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={lookup}
                      disabled={pending || institutionCode.trim().length < 4}
                      className="h-11"
                    >
                      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}{" "}
                      {tc("search")}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("wizard.institutionCodeHint")}</p>
                  {institution && (
                    <p className="flex items-center gap-2 text-sm text-success">
                      <Check className="size-4" aria-hidden />{" "}
                      {t("wizard.institutionFound", { name: institution.name })}
                    </p>
                  )}
                  {institution === null && (
                    <p className="flex items-center gap-2 text-sm text-destructive">
                      <X className="size-4" aria-hidden /> {t("wizard.institutionNotFound")}
                    </p>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="recipientName">{t("wizard.recipientName")}</Label>
                    <Input
                      id="recipientName"
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      className="h-11"
                      required
                    />
                    <p className="text-xs text-muted-foreground">{t("wizard.recipientNameHint")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="recipientEmail">{t("wizard.recipientEmail")}</Label>
                    <Input
                      id="recipientEmail"
                      type="email"
                      value={recipientEmail}
                      onChange={(e) => setRecipientEmail(e.target.value)}
                      className="h-11"
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div>
                <h2 className="text-xl font-semibold">{t("wizard.stepWhat")}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{t("wizard.categoriesHint")}</p>
              </div>
              <ul className="grid gap-2 sm:grid-cols-2">
                {SHAREABLE_CATEGORIES.map((c) => (
                  <li key={c}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition-colors tap-target",
                        categories.has(c) ? "border-primary/40 bg-primary/5" : "hover:bg-muted",
                      )}
                    >
                      <Checkbox
                        checked={categories.has(c)}
                        onCheckedChange={() => toggle(categories, c, setCategories)}
                        aria-label={t(`categories.${c}`)}
                      />
                      <span className="font-medium">{t(`categories.${c}`)}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <div>
                <h3 className="mb-2 font-semibold">{t("wizard.capabilities")}</h3>
                <ul className="space-y-2">
                  {CAPABILITIES.map((cap) => (
                    <li key={cap}>
                      <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm tap-target">
                        <Checkbox
                          checked={capabilities.has(cap)}
                          onCheckedChange={() => toggle(capabilities, cap, setCapabilities)}
                          aria-label={t(`capabilities.${cap}`)}
                        />
                        {t(`capabilities.${cap}`)}
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="text-xl font-semibold">{t("wizard.stepWhen")}</h2>
              <div className="flex flex-wrap gap-2">
                {(["hours4", "tonight", "days7", "months6", "year1", "custom"] as const).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    size="sm"
                    variant={preset === p ? "default" : "outline"}
                    onClick={() => applyPreset(p)}
                  >
                    {t(`wizard.presets.${p}`)}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={preset === "none" ? "default" : "outline"}
                  onClick={() => applyPreset("none")}
                >
                  {t("wizard.noExpiration")}
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="startsAt">{t("wizard.startsAt")}</Label>
                  <Input
                    id="startsAt"
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => {
                      setStartsAt(e.target.value);
                      setPreset("custom");
                    }}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="expiresAt">{t("wizard.expiresAt")}</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={expiresAt}
                    onChange={(e) => {
                      setExpiresAt(e.target.value);
                      setPreset(e.target.value ? "custom" : "none");
                    }}
                    className="h-11"
                  />
                </div>
              </div>
              {!expiresAt && (
                <Alert>
                  <AlertTitle>{t("wizard.noExpirationWarning")}</AlertTitle>
                </Alert>
              )}
              {!isInstitution && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="pin">{t("wizard.pin")}</Label>
                    <Input
                      id="pin"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                      className="h-11 font-mono tracking-widest"
                    />
                    <p className="text-xs text-muted-foreground">{t("wizard.pinHint")}</p>
                  </div>
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-3 rounded-xl border p-3 text-sm tap-target">
                      <Checkbox checked={singleUse} onCheckedChange={(v) => setSingleUse(Boolean(v))} />
                      <span>
                        <span className="block font-medium">{t("wizard.singleUse")}</span>
                        <span className="text-xs text-muted-foreground">{t("wizard.singleUseHint")}</span>
                      </span>
                    </label>
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="note">{t("wizard.note")}</Label>
                <Textarea id="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="text-xl font-semibold">{t("wizard.stepPreview")}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border bg-success-soft/50 p-4">
                  <p className="font-semibold">{t("preview.willSee", { name: displayName })}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {[...categories].map((c) => (
                      <li key={c} className="flex items-center gap-2">
                        <Check className="size-4 text-success" aria-hidden /> {t(`categories.${c}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-2xl border bg-muted/50 p-4">
                  <p className="font-semibold">{t("preview.willNotSee", { name: displayName })}</p>
                  <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                    {notShared.length === 0 && <li>—</li>}
                    {notShared.map((c) => (
                      <li key={c} className="flex items-center gap-2">
                        <X className="size-4" aria-hidden /> {t(`categories.${c}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              {capabilities.size > 0 && (
                <div className="rounded-2xl border p-4">
                  <p className="font-semibold">{t("preview.canDo", { name: displayName })}</p>
                  <ul className="mt-2 space-y-1 text-sm">
                    {[...capabilities].map((c) => (
                      <li key={c} className="flex items-center gap-2">
                        <Check className="size-4 text-primary" aria-hidden /> {t(`capabilities.${c}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="rounded-2xl border p-4 text-sm">
                <p>
                  <span className="font-semibold">{t("preview.accessStarts")}</span>{" "}
                  {formatDateTime(new Date(startsAt), locale)}
                </p>
                <p className="mt-1">
                  <span className="font-semibold">{t("preview.accessExpires")}</span>{" "}
                  {expiresAt ? formatDateTime(new Date(expiresAt), locale) : t("preview.never")}
                </p>
                {expiresAt && <p className="mt-1 text-muted-foreground">{t("preview.autoExpire")}</p>}
                <p className="mt-2 flex flex-wrap gap-2">
                  {pin && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t("preview.pinProtected")}</span>
                  )}
                  {singleUse && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">{t("preview.singleUse")}</span>
                  )}
                </p>
              </div>
              <label className="flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm font-medium tap-target">
                <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(Boolean(v))} />
                {t("preview.confirm")}
              </label>
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{error}</AlertTitle>
                  <AlertDescription>{tc("retry")}</AlertDescription>
                </Alert>
              )}
            </>
          )}

          <div className="flex items-center justify-between gap-3 pt-2">
            {step === 0 ? (
              <Button asChild variant="ghost">
                <Link href={`/app/children/${childId}`}>{tc("cancel")}</Link>
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)} disabled={pending}>
                {tc("back")}
              </Button>
            )}
            {step < 3 ? (
              <Button
                type="button"
                size="lg"
                onClick={() => setStep((s) => s + 1)}
                disabled={
                  (step === 0 && !whoValid) || (step === 1 && categories.size === 0) || (step === 2 && !whenValid)
                }
              >
                {tc("next")}
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={submit} disabled={pending || !confirmed}>
                {pending && <Loader2 className="animate-spin" aria-hidden />}
                {isInstitution ? t("wizard.createInstitution") : t("wizard.create")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
