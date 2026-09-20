import { describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/prisma";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { profileService } from "@/modules/profiles/application/profile.service";
import { careService } from "@/modules/care/application/care.service";
import { expectAppError, makeChildWithProfile, makeUser } from "./helpers";

async function connectedInstitution() {
  const luis = await makeUser("Luis");
  const mariana = await makeUser("Mariana");
  const sofia = await makeUser("Sofia");
  const child = await makeChildWithProfile(luis);
  const kinder = await institutionService.create(mariana, { name: "Kinder Test", type: "KINDERGARTEN" });
  await institutionService.addMember(mariana, kinder.id, sofia.email, "MEMBER", "Teacher");
  const share = await sharingService.create(luis, child.id, {
    recipientKind: "INSTITUTION",
    recipientName: kinder.name,
    institutionCode: kinder.inviteCode,
    dataCategories: ["EMERGENCY", "ALLERGIES", "MEDICATION", "SLEEP", "SOCIAL"],
    capabilities: ["ACKNOWLEDGE", "PROPOSE_CHANGES"],
    singleUse: false,
  });
  return { luis, mariana, sofia, child, kinder, share };
}

describe("Institution journey", () => {
  it("guardian shares → pending until an admin accepts → members can read shared categories only", async () => {
    const { luis, mariana, sofia, child, kinder, share } = await connectedInstitution();
    expect(share.grant.status).toBe("PENDING");
    expect(await authorizationService.can(sofia, "child.read", child.id)).toEqual({
      allowed: false,
      reason: "ACCESS_PENDING",
    });

    const pending = await institutionService.listPendingRequests(mariana, kinder.id);
    expect(pending).toHaveLength(1);
    await expectAppError(institutionService.acceptRequest(sofia, kinder.id, pending[0].id), "ACCESS_DENIED"); // members cannot accept
    await institutionService.acceptRequest(mariana, kinder.id, pending[0].id);

    const view = await institutionService.getChild(sofia, kinder.id, child.id);
    const categories = new Set(
      view.items.map((i) => (i.section === "HEALTH" && i.itemType === "ALLERGY" ? "ALLERGIES" : i.section)),
    );
    expect(categories.has("ALLERGIES")).toBe(true);
    expect(categories.has("BATHROOM")).toBe(false);
    expect(categories.has("PLAY")).toBe(false);
    expect(view.items.some((i) => i.itemType === "CONDITION")).toBe(false); // HEALTH history not shared
    expect(view.grant.grantedBy.id).toBe(luis.userId);
  });

  it("institution members cannot access a child that was not shared with them", async () => {
    const { sofia, kinder, luis } = await connectedInstitution();
    const other = await makeChildWithProfile(luis, "Other");
    await expectAppError(institutionService.getChild(sofia, kinder.id, other.id), "ACCESS_DENIED");
    expect(await authorizationService.can(sofia, "child.read", other.id)).toEqual({
      allowed: false,
      reason: "ACCESS_DENIED",
    });
    const list = await institutionService.listChildren(sofia, kinder.id);
    expect(list.map((r) => r.child.id)).not.toContain(other.id);
  });

  it("a member of another institution cannot see the institution's children", async () => {
    const { kinder } = await connectedInstitution();
    const outsider = await makeUser("Outsider");
    await expectAppError(institutionService.listChildren(outsider, kinder.id), "ACCESS_DENIED");
    await expectAppError(institutionService.listPendingRequests(outsider, kinder.id), "ACCESS_DENIED");
  });

  it("institutions propose; guardians decide; accepted proposals become OBSERVED items", async () => {
    const { luis, mariana, sofia, child, kinder } = await connectedInstitution();
    const pending = await institutionService.listPendingRequests(mariana, kinder.id);
    await institutionService.acceptRequest(mariana, kinder.id, pending[0].id);

    await expectAppError(
      profileService.addItem(sofia, child.id, { section: "SOCIAL", itemType: "OBSERVATION", label: "Direct edit" }),
      "ACCESS_DENIED",
    );
    const proposal = await institutionService.propose(sofia, kinder.id, child.id, {
      section: "PLAY",
      itemType: "INTEREST",
      label: "Musical instruments",
      details: "Repeated interest.",
    });
    expect(proposal.status).toBe("PROPOSED");
    await expectAppError(institutionService.review(sofia, proposal.id, "ACCEPTED"), "ACCESS_DENIED");

    const versionBefore = (await prisma.child.findUniqueOrThrow({ where: { id: child.id } })).profileVersion;
    const reviewed = await institutionService.review(luis, proposal.id, "ACCEPTED", "Thanks!");
    expect(reviewed.status).toBe("ACCEPTED");
    const item = await prisma.profileItem.findUniqueOrThrow({ where: { id: reviewed.resultingItemId! } });
    expect(item).toMatchObject({
      provenance: "OBSERVED",
      sourceType: "INSTITUTION",
      sourceLabel: "Kinder Test",
      sourceInstitutionId: kinder.id,
      section: "PLAY",
    });
    const versionAfter = (await prisma.child.findUniqueOrThrow({ where: { id: child.id } })).profileVersion;
    expect(versionAfter).toBe(versionBefore + 1);
    await expectAppError(institutionService.review(luis, proposal.id, "REJECTED"), "INVALID_STATE");
  });

  it("revoking the institution's access keeps the profile intact", async () => {
    const { luis, mariana, sofia, child, kinder, share } = await connectedInstitution();
    const pending = await institutionService.listPendingRequests(mariana, kinder.id);
    await institutionService.acceptRequest(mariana, kinder.id, pending[0].id);
    await careService.acknowledge(sofia, child.id, {});
    const itemsBefore = await profileService.listItemsUnchecked(child.id);

    await sharingService.revoke(luis, share.grant.id);
    expect(await authorizationService.can(sofia, "child.read", child.id)).toEqual({
      allowed: false,
      reason: "ACCESS_REVOKED",
    });
    const relation = await prisma.childInstitution.findUnique({ where: { accessGrantId: share.grant.id } });
    expect(relation?.status).toBe("REVOKED");
    expect(await profileService.listItemsUnchecked(child.id)).toHaveLength(itemsBefore.length);
    expect((await institutionService.listChildren(mariana, kinder.id)).map((r) => r.child.id)).not.toContain(child.id);
  });

  it("only admins manage members; the last admin cannot be removed", async () => {
    const { mariana, sofia, kinder } = await connectedInstitution();
    const extra = await makeUser("Extra");
    await expectAppError(institutionService.addMember(sofia, kinder.id, extra.email, "MEMBER"), "ACCESS_DENIED");
    await expectAppError(institutionService.removeMember(mariana, kinder.id, mariana.userId), "INVALID_STATE");
    await institutionService.removeMember(mariana, kinder.id, sofia.userId);
    await expectAppError(institutionService.listChildren(sofia, kinder.id), "ACCESS_DENIED");
  });
});
