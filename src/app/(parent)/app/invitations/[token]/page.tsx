import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChildAvatar } from "@/components/feature/child-avatar";
import { requireUser } from "@/modules/identity/application/session";
import { childrenService } from "@/modules/children/application/children.service";
import { AppError } from "@/shared/errors/app-error";
import { formatDate } from "@/shared/utils/dates";
import { InvitationActions } from "../invitation-actions";

/** Landing page of the invitation email link. */
export default async function InvitationPage({ params }: PageProps<"/app/invitations/[token]">) {
  const [{ token }, user, t, tg, locale] = await Promise.all([
    params,
    requireUser(),
    getTranslations("children.invitations"),
    getTranslations("children.guardians"),
    getLocale(),
  ]);
  let invitation: Awaited<ReturnType<typeof childrenService.getInvitationByToken>> | null = null;
  try {
    invitation = await childrenService.getInvitationByToken(token);
  } catch (err) {
    if (!AppError.is(err)) throw err;
  }

  if (!invitation) {
    return (
      <div className="mx-auto max-w-lg">
        <Alert variant="destructive">
          <AlertTitle>{t("invalid")}</AlertTitle>
        </Alert>
      </div>
    );
  }

  const childName = invitation.child.preferredName ?? invitation.child.firstName;
  const expired = invitation.expiresAt < new Date();
  const wrongAccount = invitation.email !== user.email.toLowerCase();
  const usable = invitation.status === "PENDING" && !expired && !wrongAccount;

  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{t("title", { name: childName })}</CardTitle>
          <CardDescription>
            {t("body", {
              inviter: invitation.invitedBy.name,
              role: invitation.role === "OWNER" ? tg("owner") : tg("coGuardian"),
            })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
            <ChildAvatar name={`${invitation.child.firstName} ${invitation.child.lastName}`} seed={invitation.child.id} />
            <div>
              <p className="font-medium">
                {invitation.child.firstName} {invitation.child.lastName}
              </p>
              <p className="text-xs text-muted-foreground">{t("expires", { when: formatDate(invitation.expiresAt, locale, "PPP") })}</p>
            </div>
          </div>
          {invitation.status !== "PENDING" && (
            <Alert>
              <AlertTitle>{t(`status.${invitation.status}`)}</AlertTitle>
            </Alert>
          )}
          {invitation.status === "PENDING" && expired && (
            <Alert variant="destructive">
              <AlertTitle>{t("status.EXPIRED")}</AlertTitle>
            </Alert>
          )}
          {invitation.status === "PENDING" && !expired && wrongAccount && (
            <Alert variant="destructive">
              <AlertTitle>{t("wrongAccount")}</AlertTitle>
              <AlertDescription>{t("wrongAccountHint", { email: invitation.email })}</AlertDescription>
            </Alert>
          )}
          {usable ? (
            <InvitationActions invitationId={invitation.id} />
          ) : (
            <Button asChild variant="outline">
              <Link href="/app">{t("backHome")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
