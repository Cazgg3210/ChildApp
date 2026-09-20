"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Route-level error boundary: friendly message, never a stack trace. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("common");
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") console.error(error);
  }, [error]);
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center" role="alert">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-critical-soft text-critical">
        <AlertTriangle className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">{t("unknownError")}</h1>
      {error.digest && <p className="mt-2 font-mono text-xs text-muted-foreground">ref: {error.digest}</p>}
      <Button className="mt-6" onClick={reset}>
        {t("retry")}
      </Button>
    </div>
  );
}
