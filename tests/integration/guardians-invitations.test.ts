import { describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/prisma";
import { childrenService } from "@/modules/children/application/children.service";
import { profileService } from "@/modules/profiles/application/profile.service";
import { accountService } from "@/modules/identity/application/account.service";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { expectAppError, makeChildWithProfile, makeUser } from "./helpers";

describe("Guardian invitations", () => {
  it("nobody becomes a guardian without accepting from the invited account", async () => {
    const luis = await makeUser("Luis");
    const andrea = await makeUser("Andrea");
    const intruder = await makeUser("Intruder");
    const child = await makeChildWithProfile(luis);

    const { invitation, token } = await childrenService.inviteGuardian(luis, child.id, {
      email: andrea.email,
      role: "CO_GUARDIAN",
      relationshipLabel: "Madre",
    });
    expect(invitation.status).toBe("PENDING");
    // The invitation itself grants nothing.
    expect((await authorizationService.can(andrea, "child.read", child.id)).allowed).toBe(false);
    // Another account cannot hijack it, even with the link.
    const resolved = await childrenService.getInvitationByToken(token);
    expect(resolved.id).toBe(invitation.id);
    await expectAppError(childrenService.acceptInvitation(intruder, invitation.id), "ACCESS_DENIED");

    const { childId } = await childrenService.acceptInvitation(andrea, invitation.id);
    expect(childId).toBe(child.id);
    const access = await authorizationService.assert(andrea, "child.read", child.id);
    expect(access.via === "guardian" && access.role).toBe("CO_GUARDIAN");
    // Accepting twice is not possible.
    await expectAppError(childrenService.acceptInvitation(andrea, invitation.id), "INVALID_STATE");
    const audit = await prisma.auditEvent.findMany({ where: { childId: child.id, type: "GUARDIAN_ADDED" } });
    expect(audit).toHaveLength(1);
  });

  it("only owners invite; re-inviting the same email supersedes the earlier invitation; revoke works", async () => {
    const luis = await makeUser("Luis");
    const andrea = await makeUser("Andrea");
    const child = await makeChildWithProfile(luis);
    const first = await childrenService.inviteGuardian(luis, child.id, { email: andrea.email, role: "CO_GUARDIAN" });
    await childrenService.acceptInvitation(andrea, first.invitation.id);
    await expectAppError(
      childrenService.inviteGuardian(andrea, child.id, { email: "x@test.local", role: "CO_GUARDIAN" }),
      "ACCESS_DENIED",
    );
    const a = await childrenService.inviteGuardian(luis, child.id, { email: "tia@test.local", role: "CO_GUARDIAN" });
    const b = await childrenService.inviteGuardian(luis, child.id, { email: "tia@test.local", role: "OWNER" });
    expect((await prisma.guardianInvitation.findUniqueOrThrow({ where: { id: a.invitation.id } })).status).toBe("REVOKED");
    await childrenService.revokeInvitation(luis, child.id, b.invitation.id);
    expect(await childrenService.listInvitations(luis, child.id)).toHaveLength(0);
  });
});

describe("Explicit 'none' declarations", () => {
  it("adding an allergy retires the declaration; declaring none while data exists is refused", async () => {
    const luis = await makeUser("Luis");
    const child = await childrenService.create(luis, {
      firstName: "Emma",
      lastName: "Test",
      dateOfBirth: new Date("2023-01-01"),
      initialItems: [{ section: "HEALTH", itemType: "NO_KNOWN_ALLERGIES", label: "NO_KNOWN_ALLERGIES" }],
    });
    let items = await profileService.listItems(luis, child.id);
    expect(items.map((i) => i.itemType)).toContain("NO_KNOWN_ALLERGIES");

    await profileService.addItem(luis, child.id, { section: "HEALTH", itemType: "ALLERGY", label: "Peanut" });
    items = await profileService.listItems(luis, child.id);
    expect(items.map((i) => i.itemType)).not.toContain("NO_KNOWN_ALLERGIES");
    expect(items.map((i) => i.itemType)).toContain("ALLERGY");

    await expectAppError(profileService.declareNone(luis, child.id, "NO_KNOWN_ALLERGIES"), "INVALID_STATE");
    await profileService.declareNone(luis, child.id, "NO_MEDICATIONS");
    items = await profileService.listItems(luis, child.id);
    expect(items.filter((i) => i.itemType === "NO_MEDICATIONS")).toHaveLength(1);
  });
});

describe("Account deletion request", () => {
  it("retires solely-owned children, keeps co-owned ones, revokes everything and anonymizes the account", async () => {
    const luis = await makeUser("Luis");
    const andrea = await makeUser("Andrea");
    const solo = await makeChildWithProfile(luis, "Solo");
    const shared = await makeChildWithProfile(luis, "Shared");
    const inv = await childrenService.inviteGuardian(luis, shared.id, { email: andrea.email, role: "OWNER" });
    await childrenService.acceptInvitation(andrea, inv.invitation.id);

    const result = await accountService.requestDeletion(luis);
    expect(result.retiredChildren).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: luis.userId } });
    expect(user.deletedAt).not.toBeNull();
    expect(user.email).not.toBe(luis.email);
    expect(user.passwordHash).toBeNull();
    expect((await prisma.child.findUniqueOrThrow({ where: { id: solo.id } })).deletedAt).not.toBeNull();
    expect((await prisma.child.findUniqueOrThrow({ where: { id: shared.id } })).deletedAt).toBeNull();
    expect(await prisma.childGuardian.count({ where: { userId: luis.userId } })).toBe(0);
    // Andrea keeps the shared child.
    expect((await authorizationService.can(andrea, "child.read", shared.id)).allowed).toBe(true);
  });

  it("refuses while the user is the only administrator of an institution", async () => {
    const mariana = await makeUser("Mariana");
    await institutionService.create(mariana, { name: "Solo Admin Kinder", type: "KINDERGARTEN" });
    await expectAppError(accountService.requestDeletion(mariana), "INVALID_STATE");
  });
});
