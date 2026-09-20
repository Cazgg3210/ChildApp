import { describe, expect, it } from "vitest";
import {
  effectiveGrantStatus,
  evaluateGrantValidity,
  grantAllowsCapability,
  grantAllowsCategory,
  MAX_PIN_ATTEMPTS,
  visibleCategories,
  type GrantView,
} from "@/modules/authorization/domain/policy";

const now = new Date("2026-09-20T18:30:00Z");

function grant(overrides: Partial<GrantView> = {}): GrantView {
  return {
    id: "g1",
    childId: "c1",
    status: "ACTIVE",
    startsAt: new Date("2026-09-20T18:00:00Z"),
    expiresAt: new Date("2026-09-21T01:00:00Z"),
    dataCategories: ["IDENTITY", "EMERGENCY", "ALLERGIES", "SLEEP"],
    capabilities: ["ACKNOWLEDGE", "RUN_CARE_SESSION"],
    link: { status: "ACTIVE", maxUses: null, useCount: 0, hasPin: false, pinAttempts: 0 },
    ...overrides,
  };
}

describe("evaluateGrantValidity", () => {
  it("accepts an active grant inside its window", () => {
    expect(evaluateGrantValidity(grant(), now)).toEqual({ valid: true });
  });

  it("rejects a grant before its start", () => {
    expect(evaluateGrantValidity(grant({ startsAt: new Date("2026-09-20T19:00:00Z") }), now)).toEqual({
      valid: false,
      reason: "ACCESS_NOT_STARTED",
    });
  });

  it("rejects an expired grant even if the stored status is still ACTIVE", () => {
    expect(evaluateGrantValidity(grant({ expiresAt: new Date("2026-09-20T18:00:00Z") }), now)).toEqual({
      valid: false,
      reason: "ACCESS_EXPIRED",
    });
  });

  it("treats expiresAt exactly equal to now as expired", () => {
    expect(evaluateGrantValidity(grant({ expiresAt: now }), now).valid).toBe(false);
  });

  it("accepts a grant without expiration", () => {
    expect(evaluateGrantValidity(grant({ expiresAt: null }), now).valid).toBe(true);
  });

  it("rejects revoked, pending and expired statuses", () => {
    expect(evaluateGrantValidity(grant({ status: "REVOKED" }), now)).toEqual({
      valid: false,
      reason: "ACCESS_REVOKED",
    });
    expect(evaluateGrantValidity(grant({ status: "PENDING" }), now)).toEqual({
      valid: false,
      reason: "ACCESS_PENDING",
    });
    expect(evaluateGrantValidity(grant({ status: "EXPIRED" }), now)).toEqual({
      valid: false,
      reason: "ACCESS_EXPIRED",
    });
  });

  it("rejects when the share link itself was revoked", () => {
    expect(
      evaluateGrantValidity(
        grant({ link: { status: "REVOKED", maxUses: null, useCount: 0, hasPin: false, pinAttempts: 0 } }),
        now,
      ),
    ).toEqual({ valid: false, reason: "ACCESS_REVOKED" });
  });

  it("exhausts single-use links after one use", () => {
    expect(
      evaluateGrantValidity(
        grant({ link: { status: "ACTIVE", maxUses: 1, useCount: 0, hasPin: false, pinAttempts: 0 } }),
        now,
      ).valid,
    ).toBe(true);
    expect(
      evaluateGrantValidity(
        grant({ link: { status: "ACTIVE", maxUses: 1, useCount: 1, hasPin: false, pinAttempts: 0 } }),
        now,
      ),
    ).toEqual({ valid: false, reason: "ACCESS_EXHAUSTED" });
  });

  it("locks PIN-protected links after too many failed attempts", () => {
    expect(
      evaluateGrantValidity(
        grant({ link: { status: "ACTIVE", maxUses: null, useCount: 0, hasPin: true, pinAttempts: MAX_PIN_ATTEMPTS } }),
        now,
      ),
    ).toEqual({ valid: false, reason: "PIN_LOCKED" });
    expect(
      evaluateGrantValidity(
        grant({
          link: { status: "ACTIVE", maxUses: null, useCount: 0, hasPin: true, pinAttempts: MAX_PIN_ATTEMPTS - 1 },
        }),
        now,
      ).valid,
    ).toBe(true);
  });

  it("ignores link rules for grants without a link (institution / user subjects)", () => {
    expect(evaluateGrantValidity(grant({ link: null }), now).valid).toBe(true);
  });
});

describe("categories and capabilities", () => {
  it("always allows IDENTITY", () => {
    expect(grantAllowsCategory(grant({ dataCategories: [] }), "IDENTITY")).toBe(true);
  });

  it("denies categories that were not shared", () => {
    expect(grantAllowsCategory(grant(), "DOCUMENTS")).toBe(false);
    expect(grantAllowsCategory(grant(), "HEALTH")).toBe(false);
    expect(grantAllowsCategory(grant(), "ALLERGIES")).toBe(true);
  });

  it("checks capabilities explicitly", () => {
    expect(grantAllowsCapability(grant(), "PROPOSE_CHANGES")).toBe(false);
    expect(grantAllowsCapability(grant(), "ACKNOWLEDGE")).toBe(true);
  });

  it("visibleCategories includes IDENTITY exactly once", () => {
    const visible = visibleCategories(grant({ dataCategories: ["EMERGENCY"] }));
    expect(visible).toEqual(["IDENTITY", "EMERGENCY"]);
    expect(visibleCategories(grant()).filter((c) => c === "IDENTITY")).toHaveLength(1);
  });
});

describe("effectiveGrantStatus", () => {
  it("maps validity to display statuses", () => {
    expect(effectiveGrantStatus(grant(), now)).toBe("ACTIVE");
    expect(effectiveGrantStatus(grant({ status: "REVOKED" }), now)).toBe("REVOKED");
    expect(effectiveGrantStatus(grant({ status: "PENDING" }), now)).toBe("PENDING");
    expect(effectiveGrantStatus(grant({ startsAt: new Date("2026-09-21T00:00:00Z") }), now)).toBe("NOT_STARTED");
    expect(effectiveGrantStatus(grant({ expiresAt: new Date("2026-09-20T00:00:00Z") }), now)).toBe("EXPIRED");
    expect(
      effectiveGrantStatus(
        grant({ link: { status: "ACTIVE", maxUses: 1, useCount: 1, hasPin: false, pinAttempts: 0 } }),
        now,
      ),
    ).toBe("EXHAUSTED");
  });
});
