import { describe, expect, it } from "vitest";
import { prisma } from "@/shared/db/prisma";
import { openSecret, sealSecret } from "@/shared/security/secretbox";
import { platformAdminService } from "@/modules/platform/application/platform-admin.service";
import { platformSettingsService } from "@/modules/platform/application/platform-settings.service";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { identityService } from "@/modules/identity/application/identity.service";
import { expectAppError, makeUser } from "./helpers";

async function makeAdmin() {
  const admin = await makeUser("Admin");
  await prisma.user.update({ where: { id: admin.userId }, data: { platformRole: "PLATFORM_ADMIN" } });
  return admin;
}

describe("Platform administration", () => {
  it("is unreachable for guardians and institution admins", async () => {
    const luis = await makeUser("Luis");
    await institutionService.create(luis, { name: "Kinder Luis", type: "KINDERGARTEN" });
    expect(await authorizationService.canPlatformAdmin(luis)).toBe(false);
    await expectAppError(platformAdminService.overview(luis), "ACCESS_DENIED");
    await expectAppError(platformAdminService.listUsers(luis), "ACCESS_DENIED");
    await expectAppError(platformAdminService.saveSecurity(luis, { requireEmailVerification: true }), "ACCESS_DENIED");
  });

  it("lets a platform admin verify and suspend institutions, and manage roles", async () => {
    const admin = await makeAdmin();
    const mariana = await makeUser("Mariana");
    const kinder = await institutionService.create(mariana, { name: "Kinder Verify", type: "KINDERGARTEN" });

    const verified = await platformAdminService.setInstitutionVerification(admin, kinder.id, "VERIFIED");
    expect(verified.verificationStatus).toBe("VERIFIED");
    const audit = await prisma.auditEvent.findFirst({ where: { institutionId: kinder.id, type: "INSTITUTION_VERIFIED" } });
    expect(audit?.actorUserId).toBe(admin.userId);

    const listed = await platformAdminService.listInstitutions(admin, { status: "VERIFIED", q: "Verify" });
    expect(listed.some((i) => i.id === kinder.id)).toBe(true);

    await platformAdminService.setPlatformRole(admin, mariana.userId, "PLATFORM_ADMIN");
    expect(await authorizationService.canPlatformAdmin(mariana)).toBe(true);
    await expectAppError(platformAdminService.setPlatformRole(admin, admin.userId, "NONE"), "INVALID_STATE");
    await platformAdminService.setPlatformRole(admin, mariana.userId, "NONE");
    expect(await authorizationService.canPlatformAdmin(mariana)).toBe(false);
  });

  it("stores settings with encrypted secrets and overrides the environment", async () => {
    const admin = await makeAdmin();
    expect(openSecret(sealSecret("s3cret"))).toBe("s3cret");
    expect(openSecret("garbage")).toBeNull();

    await platformAdminService.saveMail(admin, {
      provider: "smtp",
      host: "smtp.test.local",
      port: 465,
      secure: true,
      user: "apikey",
      password: "p4ss",
      from: "CCP <no-reply@test.local>",
    });
    const mail = await platformSettingsService.mail();
    expect(mail.source).toBe("database");
    expect(mail.value.host).toBe("smtp.test.local");
    expect(mail.value.passwordEnc).not.toContain("p4ss");
    expect(await platformSettingsService.mailPassword()).toBe("p4ss");
    // Saving without a password keeps the stored one.
    await platformAdminService.saveMail(admin, { ...mail.value, password: null });
    expect(await platformSettingsService.mailPassword()).toBe("p4ss");

    await platformAdminService.saveSecurity(admin, { requireEmailVerification: true });
    const unverified = await makeUser("Nuevo");
    await prisma.user.update({ where: { id: unverified.userId }, data: { emailVerifiedAt: null } });
    await expectAppError(identityService.assertVerified(unverified.userId), "EMAIL_NOT_VERIFIED");

    await platformAdminService.resetSetting(admin, "security");
    await platformAdminService.resetSetting(admin, "mail");
    expect((await platformSettingsService.mail()).source).toBe("environment");
    expect((await platformSettingsService.security()).source).toBe("environment");
  });
});
