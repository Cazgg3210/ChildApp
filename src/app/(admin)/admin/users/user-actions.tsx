"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, MailCheck, Send, ShieldCheck, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  adminMarkEmailVerifiedAction,
  adminResendVerificationAction,
  adminSetPlatformRoleAction,
} from "@/modules/platform/presentation/actions";

export function UserActions({
  userId,
  isSelf,
  isPlatformAdmin,
  emailVerified,
  deleted,
}: {
  userId: string;
  isSelf: boolean;
  isPlatformAdmin: boolean;
  emailVerified: boolean;
  deleted: boolean;
}) {
  const t = useTranslations("admin.users");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, done: string, confirm?: string) =>
    start(async () => {
      if (confirm && !window.confirm(confirm)) return;
      const res = await fn();
      if (res.ok) toast.success(done);
      else toast.error(res.message ?? "");
    });
  if (deleted) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {!emailVerified && (
        <>
          <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => adminMarkEmailVerifiedAction(userId), t("verified"))}>
            <MailCheck aria-hidden /> {t("markVerified")}
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => adminResendVerificationAction(userId), t("resent"))}>
            <Send aria-hidden /> {t("resend")}
          </Button>
        </>
      )}
      {isPlatformAdmin ? (
        <Button
          size="sm"
          variant="outline"
          disabled={pending || isSelf}
          onClick={() => run(() => adminSetPlatformRoleAction(userId, "NONE"), t("roleUpdated"), t("revokeConfirm"))}
        >
          <ShieldOff aria-hidden /> {t("revokeAdmin")}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run(() => adminSetPlatformRoleAction(userId, "PLATFORM_ADMIN"), t("roleUpdated"), t("grantConfirm"))}
        >
          {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />} {t("grantAdmin")}
        </Button>
      )}
    </div>
  );
}
