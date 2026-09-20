import { describe, expect, it } from "vitest";
import {
  generateInviteCode,
  generateSecureToken,
  hashToken,
  signValue,
  verifySignedValue,
} from "@/shared/security/tokens";
import { careShareInputSchema } from "@/modules/sharing/domain/share-input";
import { DEFAULT_CATEGORIES } from "@/shared/domain/care-vocabulary";

describe("share tokens", () => {
  it("are long, url-safe and unique", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateSecureToken()));
    expect(tokens.size).toBe(200);
    for (const t of tokens) {
      expect(t.length).toBeGreaterThanOrEqual(43);
      expect(t).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("hash deterministically and irreversibly", () => {
    const t = generateSecureToken();
    expect(hashToken(t)).toBe(hashToken(t));
    expect(hashToken(t)).toHaveLength(64);
    expect(hashToken(t)).not.toContain(t);
  });

  it("signed values reject tampering", () => {
    const signed = signValue("link1|123", "s".repeat(40));
    expect(verifySignedValue(signed, "s".repeat(40))).toBe("link1|123");
    expect(verifySignedValue(signed.replace("link1", "link2"), "s".repeat(40))).toBeNull();
    expect(verifySignedValue(signed, "x".repeat(40))).toBeNull();
    expect(verifySignedValue("garbage", "s".repeat(40))).toBeNull();
  });

  it("invite codes are readable and prefixed", () => {
    const code = generateInviteCode("Kinder Arcoíris");
    expect(code).toMatch(/^KIN-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
  });
});

describe("careShareInputSchema", () => {
  const base = {
    recipientKind: "BABYSITTER" as const,
    recipientName: "Carla",
    dataCategories: DEFAULT_CATEGORIES.BABYSITTER,
    capabilities: ["ACKNOWLEDGE" as const],
  };

  it("accepts a minimal babysitter share", () => {
    expect(careShareInputSchema.safeParse(base).success).toBe(true);
  });

  it("requires an institution code for institutions", () => {
    const res = careShareInputSchema.safeParse({ ...base, recipientKind: "INSTITUTION" });
    expect(res.success).toBe(false);
  });

  it("validates PIN format and date ordering", () => {
    expect(careShareInputSchema.safeParse({ ...base, pin: "12" }).success).toBe(false);
    expect(careShareInputSchema.safeParse({ ...base, pin: "1234" }).success).toBe(true);
    expect(
      careShareInputSchema.safeParse({ ...base, startsAt: "2026-09-21T18:00:00Z", expiresAt: "2026-09-21T17:00:00Z" })
        .success,
    ).toBe(false);
  });

  it("requires at least one category", () => {
    expect(careShareInputSchema.safeParse({ ...base, dataCategories: [] }).success).toBe(false);
  });
});
