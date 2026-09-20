"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Check, Loader2, Plus, Share2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { createChildAction } from "@/modules/children/presentation/actions";
import type { ProfileItemPayload } from "@/modules/children/presentation/schemas";
import { cn } from "@/lib/utils";

type Entry = { label: string; a?: string; b?: string };

const STEPS = ["basics", "safety", "food", "sleep", "ready"] as const;

export function CreateChildWizard() {
  const t = useTranslations("children");
  const tc = useTranslations("common");
  const tp = useTranslations("profile");
  const [step, setStep] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [childId, setChildId] = useState<string | null>(null);

  const [basics, setBasics] = useState({
    firstName: "",
    lastName: "",
    preferredName: "",
    dateOfBirth: "",
    primaryLanguage: "es",
  });
  const [noAllergies, setNoAllergies] = useState(false);
  const [allergies, setAllergies] = useState<Entry[]>([]);
  const [medications, setMedications] = useState<Entry[]>([]);
  const [contacts, setContacts] = useState<Entry[]>([{ label: "", a: "", b: "" }]);
  const [restricted, setRestricted] = useState<Entry[]>([]);
  const [preferences, setPreferences] = useState<Entry[]>([]);
  const [feedingRoutine, setFeedingRoutine] = useState("");
  const [napTime, setNapTime] = useState("");
  const [sleepRoutine, setSleepRoutine] = useState("");
  const [comfortObject, setComfortObject] = useState("");
  const [soothing, setSoothing] = useState("");

  const basicsValid = basics.firstName.trim() && basics.lastName.trim() && basics.dateOfBirth;

  const buildItems = (): ProfileItemPayload[] => {
    const items: ProfileItemPayload[] = [];
    for (const a of allergies.filter((e) => e.label.trim())) {
      items.push({
        section: "HEALTH",
        itemType: "ALLERGY",
        label: a.label.trim(),
        details: a.b?.trim() || null,
        data: a.a ? { severity: a.a } : null,
      });
    }
    for (const m of medications.filter((e) => e.label.trim())) {
      items.push({
        section: "HEALTH",
        itemType: "MEDICATION",
        label: m.label.trim(),
        data: { dose: m.a ?? "", schedule: m.b ?? "" },
      });
    }
    for (const c of contacts.filter((e) => e.label.trim())) {
      items.push({
        section: "EMERGENCY",
        itemType: "CONTACT",
        label: c.label.trim(),
        data: { relationship: c.a ?? "", phone: c.b ?? "" },
      });
    }
    for (const r of restricted.filter((e) => e.label.trim()))
      items.push({ section: "NUTRITION", itemType: "RESTRICTED_FOOD", label: r.label.trim() });
    for (const p of preferences.filter((e) => e.label.trim()))
      items.push({ section: "NUTRITION", itemType: "PREFERENCE", label: p.label.trim() });
    if (feedingRoutine.trim())
      items.push({
        section: "NUTRITION",
        itemType: "FEEDING_ROUTINE",
        label: tp("itemTypes.FEEDING_ROUTINE"),
        details: feedingRoutine.trim(),
      });
    if (napTime)
      items.push({ section: "SLEEP", itemType: "SCHEDULE", label: t("create.napLabel"), data: { time: napTime } });
    if (sleepRoutine.trim())
      items.push({
        section: "SLEEP",
        itemType: "ROUTINE",
        label: tp("itemTypes.ROUTINE"),
        details: sleepRoutine.trim(),
      });
    if (comfortObject.trim())
      items.push({ section: "COMFORT", itemType: "PREFERRED_OBJECT", label: comfortObject.trim() });
    if (soothing.trim())
      items.push({
        section: "COMFORT",
        itemType: "SOOTHING_STRATEGY",
        label: tp("itemTypes.SOOTHING_STRATEGY"),
        details: soothing.trim(),
      });
    return items;
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await createChildAction({
        firstName: basics.firstName,
        lastName: basics.lastName,
        preferredName: basics.preferredName || null,
        dateOfBirth: new Date(basics.dateOfBirth),
        primaryLanguage: basics.primaryLanguage,
        secondaryLanguages: [],
        initialItems: buildItems(),
      });
      if (res.ok && res.data) {
        setChildId(res.data.childId);
        setStep(4);
      } else if (!res.ok) {
        setError(res.message);
      }
    });
  };

  const displayName = basics.preferredName || basics.firstName;

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
              {t(`create.steps.${s}`)}
            </span>
          </li>
        ))}
      </ol>

      <Card>
        <CardContent className="space-y-6 pt-6">
          {step === 0 && (
            <>
              <StepTitle title={t("create.basicsTitle")} hint={t("create.basicsHint")} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t("fields.firstName")} id="firstName">
                  <Input
                    id="firstName"
                    value={basics.firstName}
                    onChange={(e) => setBasics({ ...basics, firstName: e.target.value })}
                    className="h-11"
                    autoFocus
                    required
                  />
                </Field>
                <Field label={t("fields.lastName")} id="lastName">
                  <Input
                    id="lastName"
                    value={basics.lastName}
                    onChange={(e) => setBasics({ ...basics, lastName: e.target.value })}
                    className="h-11"
                    required
                  />
                </Field>
                <Field label={`${t("fields.preferredName")} (${tc("optional")})`} id="preferredName">
                  <Input
                    id="preferredName"
                    value={basics.preferredName}
                    onChange={(e) => setBasics({ ...basics, preferredName: e.target.value })}
                    className="h-11"
                  />
                </Field>
                <Field label={t("fields.dateOfBirth")} id="dateOfBirth">
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={basics.dateOfBirth}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setBasics({ ...basics, dateOfBirth: e.target.value })}
                    className="h-11"
                    required
                  />
                </Field>
                <Field label={t("fields.primaryLanguage")} id="primaryLanguage">
                  <NativeSelect
                    id="primaryLanguage"
                    value={basics.primaryLanguage}
                    onChange={(e) => setBasics({ ...basics, primaryLanguage: e.target.value })}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                    <option value="fr">Français</option>
                    <option value="pt">Português</option>
                    <option value="de">Deutsch</option>
                  </NativeSelect>
                </Field>
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <StepTitle title={t("create.safetyTitle")} hint={t("create.safetyHint")} />
              <div className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <Label>{tp("itemTypes.ALLERGY")}</Label>
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Checkbox
                        checked={noAllergies}
                        onCheckedChange={(v) => {
                          setNoAllergies(Boolean(v));
                          if (v) setAllergies([]);
                        }}
                      />
                      {t("create.noAllergies")}
                    </label>
                  </div>
                  {!noAllergies && (
                    <EntryList
                      entries={allergies}
                      onChange={setAllergies}
                      addLabel={t("create.addAllergy")}
                      placeholder={tp("itemTypes.ALLERGY")}
                      extra={[
                        { key: "a", kind: "severity", label: tp("fields.severity") },
                        { key: "b", kind: "text", label: tp("fields.reaction") },
                      ]}
                    />
                  )}
                </div>
                <div>
                  <Label className="mb-2 block">{tp("itemTypes.MEDICATION")}</Label>
                  <EntryList
                    entries={medications}
                    onChange={setMedications}
                    addLabel={t("create.addMedication")}
                    placeholder={tp("itemTypes.MEDICATION")}
                    extra={[
                      { key: "a", kind: "text", label: tp("fields.dose") },
                      { key: "b", kind: "text", label: tp("fields.schedule") },
                    ]}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">{tp("itemTypes.CONTACT")}</Label>
                  <EntryList
                    entries={contacts}
                    onChange={setContacts}
                    addLabel={t("create.addContact")}
                    placeholder={tp("fields.label")}
                    extra={[
                      { key: "a", kind: "text", label: tp("fields.relationship") },
                      { key: "b", kind: "tel", label: tp("fields.phone") },
                    ]}
                  />
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <StepTitle title={t("create.foodTitle")} hint={t("create.foodHint")} />
              <div className="space-y-5">
                <div>
                  <Label className="mb-2 block">{tp("itemTypes.RESTRICTED_FOOD")}</Label>
                  <EntryList
                    entries={restricted}
                    onChange={setRestricted}
                    addLabel={tc("add")}
                    placeholder={tp("itemTypes.RESTRICTED_FOOD")}
                  />
                </div>
                <div>
                  <Label className="mb-2 block">{tp("itemTypes.PREFERENCE")}</Label>
                  <EntryList
                    entries={preferences}
                    onChange={setPreferences}
                    addLabel={tc("add")}
                    placeholder={tp("itemTypes.PREFERENCE")}
                  />
                </div>
                <Field label={tp("itemTypes.FEEDING_ROUTINE")} id="feeding">
                  <Textarea
                    id="feeding"
                    rows={3}
                    value={feedingRoutine}
                    onChange={(e) => setFeedingRoutine(e.target.value)}
                  />
                </Field>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <StepTitle title={t("create.sleepTitle")} hint={t("create.sleepHint")} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={tp("itemTypes.SCHEDULE")} id="nap">
                  <Input
                    id="nap"
                    type="time"
                    value={napTime}
                    onChange={(e) => setNapTime(e.target.value)}
                    className="h-11"
                  />
                </Field>
                <Field label={tp("itemTypes.PREFERRED_OBJECT")} id="comfort">
                  <Input
                    id="comfort"
                    value={comfortObject}
                    onChange={(e) => setComfortObject(e.target.value)}
                    className="h-11"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label={tp("itemTypes.ROUTINE")} id="sleepRoutine">
                    <Textarea
                      id="sleepRoutine"
                      rows={3}
                      value={sleepRoutine}
                      onChange={(e) => setSleepRoutine(e.target.value)}
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label={tp("itemTypes.SOOTHING_STRATEGY")} id="soothing">
                    <Textarea id="soothing" rows={2} value={soothing} onChange={(e) => setSoothing(e.target.value)} />
                  </Field>
                </div>
              </div>
            </>
          )}

          {step === 4 && childId && (
            <div className="flex flex-col items-center py-6 text-center">
              <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-success-soft text-success">
                <Check className="size-7" aria-hidden />
              </span>
              <h2 className="text-2xl font-semibold">{t("create.readyTitle", { name: displayName })}</h2>
              <p className="mt-2 max-w-md text-muted-foreground">{t("create.readyBody")}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href={`/app/children/${childId}/share/new`}>
                    <Share2 aria-hidden /> {t("create.shareNow")}
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link href={`/app/children/${childId}`}>{t("create.goToProfile")}</Link>
                </Button>
              </div>
            </div>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          )}

          {step < 4 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0 || pending}
              >
                {tc("back")}
              </Button>
              <div className="flex items-center gap-3">
                {step > 0 && step < 3 && (
                  <span className="hidden text-xs text-muted-foreground sm:inline">{t("create.skipHint")}</span>
                )}
                {step < 3 ? (
                  <Button
                    type="button"
                    size="lg"
                    onClick={() => setStep((s) => s + 1)}
                    disabled={step === 0 && !basicsValid}
                  >
                    {tc("next")}
                  </Button>
                ) : (
                  <Button type="button" size="lg" onClick={submit} disabled={pending}>
                    {pending && <Loader2 className="animate-spin" aria-hidden />}
                    {tc("finish")}
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StepTitle({ title, hint }: { title: string; hint: string }) {
  return (
    <div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function EntryList({
  entries,
  onChange,
  addLabel,
  placeholder,
  extra = [],
}: {
  entries: Entry[];
  onChange: (entries: Entry[]) => void;
  addLabel: string;
  placeholder: string;
  extra?: { key: "a" | "b"; kind: "text" | "tel" | "severity"; label: string }[];
}) {
  const tp = useTranslations("profile.fields");
  const tc = useTranslations("common");
  const update = (i: number, patch: Partial<Entry>) =>
    onChange(entries.map((e, idx) => (idx === i ? { ...e, ...patch } : e)));
  return (
    <div className="space-y-2">
      {entries.map((entry, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border bg-muted/30 p-3 sm:flex-row sm:items-center">
          <Input
            value={entry.label}
            placeholder={placeholder}
            onChange={(e) => update(i, { label: e.target.value })}
            className="h-11 bg-background sm:flex-1"
            aria-label={placeholder}
          />
          {extra.map((x) =>
            x.kind === "severity" ? (
              <NativeSelect
                key={x.key}
                value={entry[x.key] ?? ""}
                onChange={(e) => update(i, { [x.key]: e.target.value })}
                aria-label={x.label}
                className="bg-background sm:w-40"
              >
                <option value="">{x.label}</option>
                <option value="severe">{tp("severe")}</option>
                <option value="moderate">{tp("moderate")}</option>
                <option value="mild">{tp("mild")}</option>
              </NativeSelect>
            ) : (
              <Input
                key={x.key}
                type={x.kind}
                value={entry[x.key] ?? ""}
                placeholder={x.label}
                onChange={(e) => update(i, { [x.key]: e.target.value })}
                className="h-11 bg-background sm:w-44"
                aria-label={x.label}
              />
            ),
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={tc("delete")}
            onClick={() => onChange(entries.filter((_, idx) => idx !== i))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...entries, { label: "", a: "", b: "" }])}
      >
        <Plus aria-hidden /> {addLabel}
      </Button>
    </div>
  );
}
