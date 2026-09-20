import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";

export async function DemoAccounts({ password }: { password: string }) {
  const t = await getTranslations("auth.demo");
  return (
    <div className="mt-6 rounded-xl border border-dashed bg-muted/40 p-4 text-sm">
      <div className="mb-2 flex items-center gap-2">
        <Badge variant="secondary">{t("title")}</Badge>
        <span className="text-xs text-muted-foreground">{t("hint", { password })}</span>
      </div>
      <ul className="grid gap-1 text-xs sm:grid-cols-2">
        {DEMO_ACCOUNTS.map((a) => (
          <li key={a.email} className="flex flex-col">
            <span className="font-medium">{t(a.labelKey)}</span>
            <code className="text-muted-foreground">{a.email}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
