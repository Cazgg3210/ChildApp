import { getTranslations } from "next-intl/server";
import { ShieldOff } from "lucide-react";

const KNOWN = [
  "ACCESS_EXPIRED",
  "ACCESS_REVOKED",
  "ACCESS_NOT_STARTED",
  "ACCESS_EXHAUSTED",
  "ACCESS_PENDING",
  "INVALID_TOKEN",
  "PIN_LOCKED",
] as const;

/** Friendly, non-technical denial: never a bare "403". */
export async function DeniedView({ reason }: { reason: string }) {
  const t = await getTranslations("care.denied");
  const key = (KNOWN as readonly string[]).includes(reason) ? (reason as (typeof KNOWN)[number]) : "default";
  return (
    <div className="flex flex-col items-center py-16 text-center" role="alert">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <ShieldOff className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">{t(`${key}.title`)}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t(`${key}.body`)}</p>
    </div>
  );
}
