import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">
      <span className="mb-4 inline-flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <SearchX className="size-7" aria-hidden />
      </span>
      <h1 className="text-2xl font-semibold">{t("notFound")}</h1>
      <p className="mt-2 max-w-sm text-muted-foreground">{t("notFoundHint")}</p>
      <Button asChild className="mt-6">
        <Link href="/">{t("goHome")}</Link>
      </Button>
    </div>
  );
}
