import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { requireUser } from "@/modules/identity/application/session";
import { notificationService } from "@/modules/notifications/application/notification.service";
import { markAllReadAction } from "@/modules/notifications/presentation/actions";
import { formatRelative } from "@/shared/utils/dates";
import { cn } from "@/lib/utils";

export default async function NotificationsPage() {
  const user = await requireUser();
  const [t, locale, items] = await Promise.all([
    getTranslations("notifications"),
    getLocale(),
    notificationService.list(user.id),
  ]);
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title={t("title")}
        description={unread > 0 ? t("unread", { count: unread }) : undefined}
        actions={
          unread > 0 && (
            <form action={markAllReadAction}>
              <Button type="submit" variant="outline" size="sm">
                {t("markAllRead")}
              </Button>
            </form>
          )
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title={t("empty")} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {items.map((n) => {
            const data = (n.data ?? {}) as {
              childId?: string;
              institutionId?: string;
              proposalId?: string;
              actorName?: string;
              childName?: string;
              institutionName?: string;
              decision?: string;
            };
            const values = {
              actorName: data.actorName ?? "",
              childName: data.childName ?? "",
              institutionName: data.institutionName ?? "",
              decision: data.decision ?? "",
            };
            const title = t.has(`types.${n.type}`) ? t(`types.${n.type}`, values) : n.title;
            const href =
              data.proposalId && data.childId
                ? `/app/children/${data.childId}/proposals`
                : data.childId
                  ? `/app/children/${data.childId}/activity`
                  : undefined;
            const body = (
              <>
                <p className={cn("text-sm", !n.readAt && "font-semibold")}>{title}</p>
                {n.body && n.body !== title && <p className="text-sm text-muted-foreground">{n.body}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatRelative(n.createdAt, locale)}</p>
              </>
            );
            return (
              <li key={n.id} className={cn("px-4 py-3", !n.readAt && "bg-primary/5")}>
                {href ? (
                  <Link href={href} className="block">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
