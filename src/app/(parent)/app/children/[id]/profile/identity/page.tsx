import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toDateInputValue } from "@/shared/utils/dates";
import { childrenService } from "@/modules/children/application/children.service";
import { loadGuardianChild } from "../../_lib/load-child";
import { IdentityForm } from "./identity-form";
import { GuardiansPanel } from "./guardians-panel";
import { DeleteChildButton } from "./delete-child";

export default async function IdentityPage({ params }: PageProps<"/app/children/[id]/profile/identity">) {
  const { id } = await params;
  const { child, user, access, actor } = await loadGuardianChild(id);
  const isOwner = access.via === "guardian" && access.role === "OWNER";
  const [t, tp, invitations] = await Promise.all([
    getTranslations("children"),
    getTranslations("profile"),
    isOwner ? childrenService.listInvitations(actor, id) : Promise.resolve([]),
  ]);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{tp("groups.identity")}</CardTitle>
          <CardDescription>{t("fields.photoHint")}</CardDescription>
        </CardHeader>
        <CardContent>
          <IdentityForm
            childId={child.id}
            defaults={{
              firstName: child.firstName,
              lastName: child.lastName,
              preferredName: child.preferredName ?? "",
              dateOfBirth: toDateInputValue(child.dateOfBirth),
              primaryLanguage: child.primaryLanguage,
              secondaryLanguages: child.secondaryLanguages.join(", "),
            }}
          />
        </CardContent>
      </Card>
      <div className="space-y-6">
        <GuardiansPanel
          childId={child.id}
          currentUserId={user.id}
          isOwner={isOwner}
          guardians={child.guardians.map((g) => ({
            userId: g.userId,
            name: g.user.name,
            email: g.user.email,
            role: g.role,
            relationshipLabel: g.relationshipLabel,
          }))}
          invitations={invitations.map((i) => ({
            id: i.id,
            email: i.email,
            role: i.role,
            expiresAt: i.expiresAt.toISOString(),
          }))}
        />
        {isOwner && <DeleteChildButton childId={child.id} name={child.preferredName ?? child.firstName} />}
      </div>
    </div>
  );
}
