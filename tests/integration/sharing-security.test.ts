import { describe, expect, it } from "vitest";
import { addHours, subHours } from "date-fns";
import { prisma } from "@/shared/db/prisma";
import { sharingService } from "@/modules/sharing/application/sharing.service";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { profileService, filterItemsByCategories } from "@/modules/profiles/application/profile.service";
import { careService } from "@/modules/care/application/care.service";
import { childrenService } from "@/modules/children/application/children.service";
import { categoryOf } from "@/modules/profiles/domain/catalog";
import type { LinkActor } from "@/modules/identity/domain/types";
import { expectAppError, makeChildWithProfile, makeUser } from "./helpers";

function tokenOf(url: string | null): string {
  return url!.split("/s/")[1];
}

describe("Care Share security", () => {
  it("caregiver sees only shared categories; non-shared fields are filtered and denied", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "BABYSITTER",
      recipientName: "Carla",
      dataCategories: ["EMERGENCY", "ALLERGIES", "SLEEP"],
      capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
      singleUse: false,
    });
    const resolved = await sharingService.resolveToken(tokenOf(share.url));
    expect(resolved.ok).toBe(true);
    if (!resolved.ok) return;
    const items = filterItemsByCategories(await profileService.listItemsUnchecked(child.id), resolved.categories);
    const categories = new Set(items.map((i) => categoryOf(i.section, i.itemType)));
    expect(categories.has("EMERGENCY")).toBe(true);
    expect(categories.has("ALLERGIES")).toBe(true);
    expect(categories.has("HEALTH")).toBe(false); // medical history not shared
    expect(categories.has("BATHROOM")).toBe(false);
    expect(categories.has("PLAY")).toBe(false);

    const actor: LinkActor = {
      type: "link",
      grantId: resolved.grant.id,
      linkId: resolved.link.id,
      childId: child.id,
      recipientName: "Carla",
    };
    expect(await authorizationService.can(actor, "profile.read", child.id, { category: "BATHROOM" })).toEqual({
      allowed: false,
      reason: "CATEGORY_NOT_SHARED",
    });
    expect((await authorizationService.can(actor, "profile.read", child.id, { category: "ALLERGIES" })).allowed).toBe(
      true,
    );
  });

  it("revocation is immediate and the audit trail records it", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "FAMILY",
      recipientName: "Rosa",
      dataCategories: ["EMERGENCY"],
      capabilities: [],
      singleUse: false,
    });
    expect((await sharingService.resolveToken(tokenOf(share.url))).ok).toBe(true);
    await sharingService.revoke(luis, share.grant.id);
    expect(await sharingService.resolveToken(tokenOf(share.url))).toEqual({ ok: false, reason: "ACCESS_REVOKED" });
    const consent = await prisma.consent.findUnique({ where: { accessGrantId: share.grant.id } });
    expect(consent?.status).toBe("REVOKED");
    expect(consent?.revokedAt).not.toBeNull();
    const audit = await prisma.auditEvent.findMany({
      where: { childId: child.id, type: { in: ["ACCESS_REVOKED", "SHARE_LINK_DENIED"] } },
    });
    expect(audit.map((a) => a.type).sort()).toEqual(["ACCESS_REVOKED", "SHARE_LINK_DENIED"]);
  });

  it("expired and not-yet-started grants are rejected regardless of stored status", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "BABYSITTER",
      recipientName: "Carla",
      dataCategories: ["EMERGENCY"],
      capabilities: [],
      singleUse: false,
      expiresAt: addHours(new Date(), 1),
    });
    await prisma.accessGrant.update({ where: { id: share.grant.id }, data: { expiresAt: subHours(new Date(), 1) } });
    expect(await sharingService.resolveToken(tokenOf(share.url))).toEqual({ ok: false, reason: "ACCESS_EXPIRED" });
    await prisma.accessGrant.update({
      where: { id: share.grant.id },
      data: { expiresAt: addHours(new Date(), 5), startsAt: addHours(new Date(), 2) },
    });
    expect(await sharingService.resolveToken(tokenOf(share.url))).toEqual({ ok: false, reason: "ACCESS_NOT_STARTED" });
  });

  it("invalid or unknown tokens are rejected without leaking anything", async () => {
    expect(await sharingService.resolveToken("")).toEqual({ ok: false, reason: "INVALID_TOKEN" });
    expect(await sharingService.resolveToken("short")).toEqual({ ok: false, reason: "INVALID_TOKEN" });
    expect(await sharingService.resolveToken("a".repeat(43))).toEqual({ ok: false, reason: "INVALID_TOKEN" });
  });

  it("single-use links are exhausted after one opening, but the opening device keeps access", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "OTHER",
      recipientName: "Coach",
      dataCategories: ["EMERGENCY"],
      capabilities: [],
      singleUse: true,
    });
    const first = await sharingService.resolveToken(tokenOf(share.url));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    await sharingService.recordOpen(
      first.link.id,
      { type: "link", grantId: first.grant.id, linkId: first.link.id, childId: child.id, recipientName: "Coach" },
      child.id,
      first.categories,
    );
    expect(await sharingService.resolveToken(tokenOf(share.url))).toEqual({ ok: false, reason: "ACCESS_EXHAUSTED" });
    expect((await sharingService.resolveToken(tokenOf(share.url), { allowExhausted: true })).ok).toBe(true);
  });

  it("PIN: wrong attempts are counted and the link locks after 5", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "BABYSITTER",
      recipientName: "Carla",
      dataCategories: ["EMERGENCY"],
      capabilities: [],
      singleUse: false,
      pin: "2468",
    });
    const token = tokenOf(share.url);
    for (let i = 1; i <= 4; i++) {
      const res = await sharingService.verifyPin(token, "0000", { ipAddress: `10.0.0.${i}` });
      expect(res).toEqual({ ok: false, reason: "PIN_INVALID", remaining: 5 - i });
    }
    expect(await sharingService.verifyPin(token, "0000", { ipAddress: "10.0.0.9" })).toEqual({
      ok: false,
      reason: "PIN_LOCKED",
      remaining: 0,
    });
    expect(await sharingService.resolveToken(token)).toEqual({ ok: false, reason: "PIN_LOCKED" });
  });

  it("correct PIN issues a signed cookie bound to the link", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "BABYSITTER",
      recipientName: "Carla",
      dataCategories: ["EMERGENCY"],
      capabilities: [],
      singleUse: false,
      pin: "1357",
    });
    const res = await sharingService.verifyPin(tokenOf(share.url), "1357", { ipAddress: "10.1.1.1" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(sharingService.isPinCookieValid(share.grant.shareLink!.id, res.cookieValue)).toBe(true);
    expect(sharingService.isPinCookieValid("other-link", res.cookieValue)).toBe(false);
  });

  it("rotating the link invalidates the previous token", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "FAMILY",
      recipientName: "Rosa",
      dataCategories: ["EMERGENCY"],
      capabilities: [],
      singleUse: false,
    });
    const rotated = await sharingService.rotateLink(luis, share.grant.id);
    expect(await sharingService.resolveToken(tokenOf(share.url))).toEqual({ ok: false, reason: "INVALID_TOKEN" });
    expect((await sharingService.resolveToken(tokenOf(rotated.url))).ok).toBe(true);
  });
});

describe("Privilege escalation", () => {
  it("a link actor cannot modify the profile, revoke, or read the audit trail", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "BABYSITTER",
      recipientName: "Carla",
      dataCategories: ["EMERGENCY"],
      capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION", "PROPOSE_CHANGES", "VIEW_DOCUMENTS"],
      singleUse: false,
    });
    const actor: LinkActor = {
      type: "link",
      grantId: share.grant.id,
      linkId: share.grant.shareLink!.id,
      childId: child.id,
      recipientName: "Carla",
    };
    await expectAppError(
      profileService.addItem(actor, child.id, { section: "HEALTH", itemType: "ALLERGY", label: "Injected" }),
      "ACCESS_DENIED",
    );
    await expectAppError(sharingService.revoke(actor, share.grant.id), "ACCESS_DENIED");
    await expectAppError(sharingService.listForChild(actor, child.id), "ACCESS_DENIED");
    await expectAppError(childrenService.remove(actor, child.id), "ACCESS_DENIED");
  });

  it("a link actor for one child cannot use its grant on another child", async () => {
    const luis = await makeUser("Luis");
    const a = await makeChildWithProfile(luis, "A");
    const b = await makeChildWithProfile(luis, "B");
    const share = await sharingService.create(luis, a.id, {
      recipientKind: "BABYSITTER",
      recipientName: "Carla",
      dataCategories: ["EMERGENCY"],
      capabilities: ["RUN_CARE_SESSION"],
      singleUse: false,
    });
    const actor: LinkActor = {
      type: "link",
      grantId: share.grant.id,
      linkId: share.grant.shareLink!.id,
      childId: a.id,
      recipientName: "Carla",
    };
    expect(await authorizationService.can(actor, "child.read", b.id)).toEqual({
      allowed: false,
      reason: "ACCESS_DENIED",
    });
    await expectAppError(careService.startSession(actor, b.id, {}), "ACCESS_DENIED");
  });

  it("an unrelated user gets NOT_FOUND (existence is not revealed) and anonymous gets NOT_AUTHENTICATED", async () => {
    const luis = await makeUser("Luis");
    const stranger = await makeUser("Stranger");
    const child = await makeChildWithProfile(luis);
    await expectAppError(childrenService.get(stranger, child.id), "NOT_FOUND");
    await expectAppError(profileService.listItems(stranger, child.id), "ACCESS_DENIED");
    expect(await authorizationService.can({ type: "anonymous" }, "child.read", child.id)).toEqual({
      allowed: false,
      reason: "NOT_AUTHENTICATED",
    });
  });

  it("a co-guardian cannot remove the owner or delete the child", async () => {
    const luis = await makeUser("Luis");
    const andrea = await makeUser("Andrea");
    const child = await makeChildWithProfile(luis);
    await childrenService.addGuardian(luis, child.id, andrea.email, "CO_GUARDIAN");
    await expectAppError(childrenService.removeGuardian(andrea, child.id, luis.userId), "ACCESS_DENIED");
    await expectAppError(childrenService.remove(andrea, child.id), "ACCESS_DENIED");
    // But a co-guardian can update the profile.
    const res = await profileService.addItem(andrea, child.id, {
      section: "COMFORT",
      itemType: "PREFERRED_OBJECT",
      label: "Blanket",
    });
    expect(res.changes).toHaveLength(1);
  });

  it("the last owner cannot be removed", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    await expectAppError(childrenService.removeGuardian(luis, child.id, luis.userId), "INVALID_STATE");
  });
});

describe("Change detection", () => {
  it("reports only changes in shared categories since the caregiver last acknowledged", async () => {
    const luis = await makeUser("Luis");
    const child = await makeChildWithProfile(luis);
    const share = await sharingService.create(luis, child.id, {
      recipientKind: "BABYSITTER",
      recipientName: "Carla",
      dataCategories: ["EMERGENCY", "ALLERGIES", "SLEEP"],
      capabilities: ["ACKNOWLEDGE"],
      singleUse: false,
    });
    const actor: LinkActor = {
      type: "link",
      grantId: share.grant.id,
      linkId: share.grant.shareLink!.id,
      childId: child.id,
      recipientName: "Carla",
    };
    await careService.acknowledge(actor, child.id, { actorName: "Carla" });

    const items = await profileService.listItemsUnchecked(child.id);
    const nap = items.find((i) => i.itemType === "SCHEDULE")!;
    await profileService.updateItem(luis, child.id, nap.id, { details: "Now at 14:30" }); // SLEEP: visible
    await profileService.addItem(luis, child.id, {
      section: "BATHROOM",
      itemType: "INSTRUCTION",
      label: "Wipes in bag",
    }); // BATHROOM: hidden
    await profileService.addItem(luis, child.id, { section: "HEALTH", itemType: "ALLERGY", label: "Milk" }); // ALLERGIES: visible + critical

    const result = await careService.changesSinceLastReview(child.id, { grantId: share.grant.id }, [
      "IDENTITY",
      "EMERGENCY",
      "ALLERGIES",
      "SLEEP",
    ]);
    expect(result).not.toBeNull();
    const ops = result!.changes.map((c) => `${c.op}:${c.category}`).sort();
    expect(ops).toEqual(["ADDED:ALLERGIES", "UPDATED:SLEEP"]);
    expect(result!.changes.some((c) => c.critical)).toBe(true);

    const versions = await prisma.childProfileVersion.findMany({
      where: { childId: child.id },
      orderBy: { version: "asc" },
    });
    expect(versions.map((v) => v.version)).toEqual([1, 2, 3, 4, 5]);
    const audit = await prisma.auditEvent.findMany({ where: { childId: child.id, type: "CRITICAL_DATA_CHANGED" } });
    expect(audit.length).toBeGreaterThanOrEqual(1);
  });
});
