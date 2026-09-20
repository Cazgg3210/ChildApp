import { describe, expect, it } from "vitest";
import { decide, type AccessFacts } from "@/modules/authorization/domain/decide";
import type { GrantAccessView } from "@/modules/authorization/domain/types";

const now = new Date("2026-09-20T18:30:00Z");

function grant(overrides: Partial<GrantAccessView> = {}): GrantAccessView {
  return {
    id: "g1",
    childId: "c1",
    status: "ACTIVE",
    startsAt: new Date("2026-09-20T18:00:00Z"),
    expiresAt: new Date("2026-09-21T01:00:00Z"),
    dataCategories: ["IDENTITY", "EMERGENCY", "ALLERGIES", "SLEEP"],
    capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
    recipientKind: "BABYSITTER",
    recipientName: "Carla",
    subjectInstitutionId: null,
    grantedById: "u-luis",
    link: { status: "ACTIVE", maxUses: null, useCount: 0, hasPin: false, pinAttempts: 0 },
    ...overrides,
  };
}

const nobody: AccessFacts = { guardianRole: null, directGrants: [], institutionGrants: [] };

describe("decide — guardians (RBAC)", () => {
  it("owner can do everything", () => {
    const facts: AccessFacts = { ...nobody, guardianRole: "OWNER" };
    for (const action of [
      "child.read",
      "child.update",
      "child.delete",
      "child.manage_guardians",
      "profile.update",
      "share.create",
      "share.revoke",
      "audit.read",
      "proposal.review",
    ] as const) {
      const d = decide(facts, action, { now });
      expect(d.allowed, action).toBe(true);
    }
  });

  it("co-guardian cannot delete the child or manage guardians (owner-only)", () => {
    const facts: AccessFacts = { ...nobody, guardianRole: "CO_GUARDIAN" };
    expect(decide(facts, "child.delete", { now })).toEqual({ allowed: false, reason: "ACCESS_DENIED" });
    expect(decide(facts, "child.manage_guardians", { now })).toEqual({ allowed: false, reason: "ACCESS_DENIED" });
    expect(decide(facts, "profile.update", { now }).allowed).toBe(true);
    expect(decide(facts, "share.revoke", { now }).allowed).toBe(true);
  });

  it("guardian access exposes all categories and capabilities", () => {
    const d = decide({ ...nobody, guardianRole: "OWNER" }, "child.read", { now });
    expect(d.allowed && d.access.via).toBe("guardian");
    expect(d.allowed && d.access.categories).toContain("DOCUMENTS");
  });
});

describe("decide — grants (ABAC)", () => {
  it("a valid link grant can read the child and its shared categories", () => {
    const facts: AccessFacts = { ...nobody, directGrants: [grant()] };
    expect(decide(facts, "child.read", { now }).allowed).toBe(true);
    expect(decide(facts, "profile.read", { now, category: "ALLERGIES" }).allowed).toBe(true);
  });

  it("denies categories that were not shared", () => {
    const facts: AccessFacts = { ...nobody, directGrants: [grant()] };
    expect(decide(facts, "profile.read", { now, category: "DOCUMENTS" })).toEqual({
      allowed: false,
      reason: "CATEGORY_NOT_SHARED",
    });
    expect(decide(facts, "profile.read", { now, category: "HEALTH" })).toEqual({
      allowed: false,
      reason: "CATEGORY_NOT_SHARED",
    });
  });

  it("denies after expiration and before start", () => {
    expect(
      decide({ ...nobody, directGrants: [grant({ expiresAt: new Date("2026-09-20T18:00:00Z") })] }, "child.read", {
        now,
      }),
    ).toEqual({ allowed: false, reason: "ACCESS_EXPIRED" });
    expect(
      decide({ ...nobody, directGrants: [grant({ startsAt: new Date("2026-09-21T00:00:00Z") })] }, "child.read", {
        now,
      }),
    ).toEqual({ allowed: false, reason: "ACCESS_NOT_STARTED" });
  });

  it("denies revoked grants", () => {
    expect(decide({ ...nobody, directGrants: [grant({ status: "REVOKED" })] }, "child.read", { now })).toEqual({
      allowed: false,
      reason: "ACCESS_REVOKED",
    });
  });

  it("maps actions to capabilities", () => {
    const facts: AccessFacts = { ...nobody, directGrants: [grant({ capabilities: ["ACKNOWLEDGE"] })] };
    expect(decide(facts, "acknowledge", { now }).allowed).toBe(true);
    expect(decide(facts, "care_session.run", { now })).toEqual({ allowed: false, reason: "CAPABILITY_MISSING" });
    expect(decide(facts, "proposal.create", { now })).toEqual({ allowed: false, reason: "CAPABILITY_MISSING" });
  });

  it("never lets a grant reach guardian-only actions (privilege escalation)", () => {
    const facts: AccessFacts = {
      ...nobody,
      directGrants: [grant({ capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION", "PROPOSE_CHANGES", "VIEW_DOCUMENTS"] })],
    };
    for (const action of [
      "profile.update",
      "share.create",
      "share.revoke",
      "audit.read",
      "child.update",
      "child.delete",
      "proposal.review",
      "document.upload",
    ] as const) {
      expect(decide(facts, action, { now }), action).toEqual({ allowed: false, reason: "ACCESS_DENIED" });
    }
  });

  it("picks a valid grant when several exist", () => {
    const facts: AccessFacts = {
      ...nobody,
      directGrants: [grant({ id: "old", status: "REVOKED" }), grant({ id: "new" })],
    };
    const d = decide(facts, "child.read", { now });
    expect(d.allowed && d.access.via === "grant" && d.access.grant.id).toBe("new");
  });

  it("returns the most relevant denial when no grant works", () => {
    const facts: AccessFacts = { ...nobody, directGrants: [grant({ status: "REVOKED" })] };
    expect(decide(facts, "child.read", { now })).toEqual({ allowed: false, reason: "ACCESS_REVOKED" });
  });
});

describe("decide — institutions", () => {
  const institutionFacts: AccessFacts = {
    ...nobody,
    institutionGrants: [
      {
        institutionId: "inst1",
        institutionRole: "MEMBER",
        grant: grant({
          id: "gi",
          link: null,
          recipientKind: "INSTITUTION",
          subjectInstitutionId: "inst1",
          capabilities: ["ACKNOWLEDGE", "PROPOSE_CHANGES"],
          dataCategories: ["IDENTITY", "EMERGENCY", "ALLERGIES", "HEALTH", "SOCIAL"],
        }),
      },
    ],
  };

  it("institution members read only the shared categories through the institution grant", () => {
    const d = decide(institutionFacts, "child.read", { now });
    expect(d.allowed && d.access.via).toBe("institution");
    expect(d.allowed && d.access.categories).not.toContain("DOCUMENTS");
    expect(decide(institutionFacts, "profile.read", { now, category: "BATHROOM" })).toEqual({
      allowed: false,
      reason: "CATEGORY_NOT_SHARED",
    });
  });

  it("institution members can propose but never edit the profile", () => {
    expect(decide(institutionFacts, "proposal.create", { now }).allowed).toBe(true);
    expect(decide(institutionFacts, "profile.update", { now })).toEqual({ allowed: false, reason: "ACCESS_DENIED" });
  });

  it("a pending institution relationship grants nothing yet", () => {
    const pending: AccessFacts = {
      ...nobody,
      institutionGrants: [
        { institutionId: "inst1", institutionRole: "ADMIN", grant: grant({ status: "PENDING", link: null }) },
      ],
    };
    expect(decide(pending, "child.read", { now })).toEqual({ allowed: false, reason: "ACCESS_PENDING" });
  });

  it("an institution with no relationship to the child is denied", () => {
    expect(decide(nobody, "child.read", { now })).toEqual({ allowed: false, reason: "ACCESS_DENIED" });
  });
});
