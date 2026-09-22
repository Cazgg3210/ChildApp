import { getLocale, getTranslations } from "next-intl/server";
import { Mail } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { requireUser } from "@/modules/identity/application/session";
import { childrenService } from "@/modules/children/application/children.service";
import { formatDate } from "@/shared/utils/dates";
import { InvitationActions } from "./invitation-actions";

/** Pending guardian invitations addressed to the signed-in user's email. */
export default async function InvitationsPage() {
  const user = await requireUser();
  const [t, tg, locale, invitations] = await Promise.all([
    getTranslations("children.invitations"),
    getTranslations("children.guardians"),
    getLocale(),
    childrenService.listInvitationsForUser(user.email),
  ]);
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={t("listTitle")} description={t("listHint")} />
      {invitations.length === 0 ? (
        <EmptyState icon={Mail} title={t("empty")} />
      ) : (
        <ul className="space-y-3">
          {invitations.map((inv) => (
            <li key={inv.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center gap-3">
                <ChildAvatar name={`${inv.child.firstName} ${inv.child.lastName}`} seed={inv.child.id} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{t("title", { name: inv.child.preferredName ?? inv.child.firstName })}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("body", { inviter: inv.invitedBy.name, role: inv.role === "OWNER" ? tg("owner") : tg("coGuardian") })}
                  </p>
                  <p className="text-xs text-muted-foreground">{t("expires", { when: formatDate(inv.expiresAt, locale, "PPP") })}</p>
                </div>
              </div>
              <div className="mt-3">
                <InvitationActions invitationId={inv.id} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
