import { describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/prisma";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { expectAppError, makeChildWithProfile, makeUser } from "./helpers";

async function kinderWithTwoChildren() {
  const luis = await makeUser("Luis");
  const mariana = await makeUser("Mariana");
  const sofia = await makeUser("Sofia");
  const kinder = await institutionService.create(mariana, { name: "Kinder Rooms", type: "KINDERGARTEN" });
  const teacher = await institutionService.addMember(mariana, kinder.id, sofia.email, "MEMBER", "Teacher");
  const share = async (firstName: string) => {
    const child = await makeChildWithProfile(luis, firstName);
    const s = await sharingService.create(luis, child.id, {
      recipientKind: "INSTITUTION",
      recipientName: kinder.name,
      institutionCode: kinder.inviteCode,
      dataCategories: ["EMERGENCY", "ALLERGIES", "MEDICATION"],
      capabilities: ["ACKNOWLEDGE"],
      singleUse: false,
    });
    const relation = await prisma.childInstitution.findUniqueOrThrow({ where: { accessGrantId: s.grant.id } });
    await institutionService.acceptRequest(mariana, kinder.id, relation.id);
    return { child, relation };
  };
  const a = await share("Ana");
  const b = await share("Bruno");
  return { luis, mariana, sofia, kinder, teacher, a, b };
}

describe("Institution rooms (group scoping)", () => {
  it("without rooms every member sees every shared child", async () => {
    const { sofia, kinder, a, b } = await kinderWithTwoChildren();
    const rows = await institutionService.listChildren(sofia, kinder.id);
    expect(rows.map((r) => r.child.id).sort()).toEqual([a.child.id, b.child.id].sort());
  });

  it("with rooms, members only reach the children of their rooms; admins see all", async () => {
    const { mariana, sofia, kinder, teacher, a, b } = await kinderWithTwoChildren();
    const azul = await institutionService.createGroup(mariana, kinder.id, "Sala Azul");
    const verde = await institutionService.createGroup(mariana, kinder.id, "Sala Verde");
    await institutionService.setGroupMember(mariana, kinder.id, azul.id, teacher.id, true);
    await institutionService.setGroupChild(mariana, kinder.id, azul.id, a.relation.id, true);
    await institutionService.setGroupChild(mariana, kinder.id, verde.id, b.relation.id, true);

    const rows = await institutionService.listChildren(sofia, kinder.id);
    expect(rows.map((r) => r.child.id)).toEqual([a.child.id]);
    expect(rows[0].groups.map((g) => g.name)).toEqual(["Sala Azul"]);
    expect((await authorizationService.can(sofia, "child.read", b.child.id)).allowed).toBe(false);
    await expectAppError(institutionService.getChild(sofia, kinder.id, b.child.id), "ACCESS_DENIED");
    expect((await institutionService.listChildren(mariana, kinder.id)).length).toBe(2);
    // Only admins manage rooms.
    await expectAppError(institutionService.createGroup(sofia, kinder.id, "Mine"), "ACCESS_DENIED");

    // Unassigned children are only visible to admins.
    await institutionService.setGroupChild(mariana, kinder.id, azul.id, a.relation.id, false);
    expect(await institutionService.listChildren(sofia, kinder.id)).toHaveLength(0);
    // Deleting the last room lifts the restriction again.
    await institutionService.deleteGroup(mariana, kinder.id, azul.id);
    await institutionService.deleteGroup(mariana, kinder.id, verde.id);
    expect(await institutionService.listChildren(sofia, kinder.id)).toHaveLength(2);
  });

  it("dashboard reports Care Readiness restricted to the shared categories", async () => {
    const { mariana, kinder } = await kinderWithTwoChildren();
    const data = await institutionService.dashboard(mariana, kinder.id);
    // makeChildWithProfile records a contact and an allergy but says nothing about medication.
    expect(data.childrenCount).toBe(2);
    expect(data.readyProfiles).toBe(0);
    expect(data.needsReview).toBe(2);
    expect(data.children[0].readiness.checks.map((c) => c.key).sort()).toEqual(
      ["allergies", "emergencyContact", "medications"].sort(),
    );
  });

  it("verification is requested by admins and decided by the platform", async () => {
    const { mariana, sofia, kinder } = await kinderWithTwoChildren();
    await expectAppError(institutionService.requestVerification(mariana, kinder.id), "VALIDATION_ERROR");
    await institutionService.updateDetails(mariana, kinder.id, {
      legalName: "Kinder Rooms S.C.",
      contactName: "Mariana",
      phone: "555",
    });
    await expectAppError(institutionService.requestVerification(sofia, kinder.id), "ACCESS_DENIED");
    const pending = await institutionService.requestVerification(mariana, kinder.id);
    expect(pending.verificationStatus).toBe("VERIFICATION_PENDING");
    const verified = await institutionService.setVerificationStatus(kinder.id, "VERIFIED");
    expect(verified.verificationStatus).toBe("VERIFIED");
    expect(verified.verifiedAt).not.toBeNull();
  });
});
