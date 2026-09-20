import { getTranslations } from "next-intl/server";
import { Check, Eye, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DataCategory } from "@/shared/domain/care-vocabulary";

export interface CategoryVisibility {
  category: DataCategory;
  viewers: { id: string; recipientName: string; recipientKind: string; canSee: boolean }[];
}

/** Visible privacy: for each category on screen, who can currently see it. */
export async function VisibilityPanel({
  visibility,
  guardians,
}: {
  visibility: CategoryVisibility[];
  guardians: string[];
}) {
  const [t, ts] = await Promise.all([getTranslations("profile.visibleTo"), getTranslations("sharing")]);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="size-4" aria-hidden /> {t("title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("guardians")}</p>
          <ul className="space-y-1">
            {guardians.map((g) => (
              <li key={g} className="flex items-center gap-2">
                <Check className="size-4 text-success" aria-hidden /> {g}
              </li>
            ))}
          </ul>
        </div>
        {visibility.map(({ category, viewers }) => (
          <div key={category}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {ts(`categories.${category}`)}
            </p>
            {viewers.length === 0 ? (
              <p className="text-muted-foreground">{t("nobody")}</p>
            ) : (
              <ul className="space-y-1">
                {viewers.map((v) => (
                  <li key={v.id} className="flex items-center gap-2">
                    {v.canSee ? (
                      <Check className="size-4 text-success" aria-hidden />
                    ) : (
                      <X className="size-4 text-muted-foreground" aria-hidden />
                    )}
                    <span className={v.canSee ? "" : "text-muted-foreground line-through"}>{v.recipientName}</span>
                    <span className="text-xs text-muted-foreground">{ts(`kinds.${v.recipientKind}`)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
