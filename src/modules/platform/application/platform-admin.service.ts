import { subDays } from "date-fns";
import { prisma } from "@/shared/db/prisma";
import { env } from "@/shared/config/env";
import { AppError } from "@/shared/errors/app-error";
import type { RequestMeta } from "@/shared/security/request-context";
import type { InstitutionVerificationStatus, PlatformRole } from "@/generated/prisma/enums";
import type { Actor, UserActor } from "@/modules/identity/domain/types";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { AuditEventTypes } from "@/modules/audit/domain/types";
import { userRepository } from "@/modules/identity/infrastructure/user.repository";
import { identityService } from "@/modules/identity/application/identity.service";
import { mailer } from "@/modules/identity/infrastructure/mailer";
import { institutionService } from "@/modules/institutions/application/institution.service";
import { runDemoSeed, type DemoSeedResult } from "@/modules/demo/application/demo-seed";
import { DEMO_ACCOUNTS } from "@/shared/config/demo";
import { platformSettingsService } from "./platform-settings.service";
import type { FeatureSettings, MailSettings, SecuritySettings } from "../domain/settings";

/** Emails granted platform administration by configuration (bootstrap without a database change). */
export function platformAdminEmails(): string[] {
  return env()
    .PLATFORM_ADMIN_EMAILS.split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isPlatformAdmin(user: { email: string; platformRole: PlatformRole }): boolean {
  return user.platformRole === "PLATFORM_ADMIN" || platformAdminEmails().includes(user.email.toLowerCase());
}

const PAGE = 50;

/**
 * Operations reserved to the platform team (docs/10-permissions-model.md →
 * "Platform administrators"). Every call re-checks the role; nothing here is
 * reachable through family or institution roles.
 */
export const platformAdminService = {
  async overview(actor: Actor) {
    await authorizationService.assertPlatformAdmin(actor);
    const now = new Date();
    const weekAgo = subDays(now, 7);
    const [users, usersWeek, children, institutions, byStatus, activeGrants, activeLinks, sessionsWeek, pendingVerification, recentAudit, settings] =
      await Promise.all([
        prisma.user.count({ where: { deletedAt: null } }),
        prisma.user.count({ where: { deletedAt: null, createdAt: { gte: weekAgo } } }),
        prisma.child.count({ where: { deletedAt: null } }),
        prisma.institution.count(),
        prisma.institution.groupBy({ by: ["verificationStatus"], _count: { _all: true } }),
        prisma.accessGrant.count({ where: { status: "ACTIVE", OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] } }),
        prisma.shareLink.count({ where: { status: "ACTIVE" } }),
        prisma.careSession.count({ where: { startedAt: { gte: weekAgo } } }),
        prisma.institution.findMany({
          where: { verificationStatus: "VERIFICATION_PENDING" },
          orderBy: { updatedAt: "asc" },
          include: { _count: { select: { members: true, children: true } } },
        }),
        prisma.auditEvent.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
        this.settingsSummary(),
      ]);
    return {
      users,
      usersWeek,
      children,
      institutions,
      institutionsByStatus: Object.fromEntries(byStatus.map((s) => [s.verificationStatus, s._count._all])) as Partial<
        Record<InstitutionVerificationStatus, number>
      >,
      activeGrants,
      activeLinks,
      sessionsWeek,
      pendingVerification,
      recentAudit,
      settings,
    };
  },

  async settingsSummary() {
    const [mail, security, features] = await Promise.all([
      platformSettingsService.mail(),
      platformSettingsService.security(),
      platformSettingsService.features(),
    ]);
    return { mail, security, features, adminEmails: platformAdminEmails() };
  },

  // ---------------------------------------------------------------------------
  // Institutions
  // ---------------------------------------------------------------------------

  async listInstitutions(actor: Actor, filter: { q?: string; status?: InstitutionVerificationStatus } = {}) {
    await authorizationService.assertPlatformAdmin(actor);
    const q = filter.q?.trim();
    return prisma.institution.findMany({
      where: {
        ...(filter.status ? { verificationStatus: filter.status } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { legalName: { contains: q, mode: "insensitive" } },
                { inviteCode: { contains: q.toUpperCase() } },
              ],
            }
          : {}),
      },
      orderBy: [{ verificationStatus: "asc" }, { createdAt: "desc" }],
      take: PAGE,
      include: {
        createdBy: { select: { name: true, email: true } },
        _count: { select: { members: true, children: { where: { status: "ACTIVE" } }, groups: true } },
      },
    });
  },

  async setInstitutionVerification(
    actor: UserActor,
    institutionId: string,
    status: InstitutionVerificationStatus,
    meta?: RequestMeta,
  ) {
    await authorizationService.assertPlatformAdmin(actor);
    return institutionService.setVerificationStatus(institutionId, status, meta, actor);
  },

  // ---------------------------------------------------------------------------
  // Users
  // ---------------------------------------------------------------------------

  async listUsers(actor: Actor, filter: { q?: string; only?: "admins" | "unverified" | "demo" | "deleted" } = {}) {
    await authorizationService.assertPlatformAdmin(actor);
    const q = filter.q?.trim();
    const users = await prisma.user.findMany({
      where: {
        ...(filter.only === "deleted" ? { deletedAt: { not: null } } : filter.only ? { deletedAt: null } : {}),
        ...(filter.only === "admins" ? { platformRole: "PLATFORM_ADMIN" } : {}),
        ...(filter.only === "unverified" ? { emailVerifiedAt: null } : {}),
        ...(filter.only === "demo" ? { isDemo: true } : {}),
        ...(q
          ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE,
      select: {
        id: true,
        name: true,
        email: true,
        emailVerifiedAt: true,
        isDemo: true,
        platformRole: true,
        createdAt: true,
        deletedAt: true,
        _count: { select: { guardianships: true, institutionMembers: true } },
      },
    });
    const envAdmins = platformAdminEmails();
    return users.map((u) => ({ ...u, isPlatformAdmin: u.platformRole === "PLATFORM_ADMIN" || envAdmins.includes(u.email) }));
  },

  async setPlatformRole(actor: UserActor, userId: string, role: PlatformRole, meta?: RequestMeta) {
    await authorizationService.assertPlatformAdmin(actor);
    const target = await userRepository.findById(userId);
    if (!target) throw new AppError("NOT_FOUND", "User not found");
    if (role === "NONE" && target.id === actor.userId) {
      throw new AppError("INVALID_STATE", "You cannot remove your own platform role.");
    }
    if (role === "NONE" && platformAdminEmails().includes(target.email)) {
      throw new AppError("INVALID_STATE", "This administrator is defined by PLATFORM_ADMIN_EMAILS.");
    }
    await prisma.user.update({ where: { id: userId }, data: { platformRole: role } });
    await auditService.record({
      type: role === "PLATFORM_ADMIN" ? "PLATFORM_ADMIN_GRANTED" : "PLATFORM_ADMIN_REVOKED",
      actor,
      resourceType: "User",
      resourceId: userId,
      context: { email: target.email },
      meta,
    });
  },

  async markEmailVerified(actor: UserActor, userId: string, meta?: RequestMeta) {
    await authorizationService.assertPlatformAdmin(actor);
    const target = await userRepository.findById(userId);
    if (!target) throw new AppError("NOT_FOUND", "User not found");
    if (target.emailVerifiedAt) return;
    await userRepository.markEmailVerified(userId);
    await auditService.record({
      type: "EMAIL_VERIFIED",
      actor,
      resourceType: "User",
      resourceId: userId,
      context: { byPlatformAdmin: true },
      meta,
    });
  },

  async resendVerification(actor: UserActor, userId: string) {
    await authorizationService.assertPlatformAdmin(actor);
    await identityService.sendEmailVerification(userId);
  },

  // ---------------------------------------------------------------------------
  // Audit
  // ---------------------------------------------------------------------------

  auditTypes() {
    return AuditEventTypes;
  },

  async listAudit(actor: Actor, filter: { type?: string; q?: string; days?: number } = {}) {
    await authorizationService.assertPlatformAdmin(actor);
    const q = filter.q?.trim();
    return prisma.auditEvent.findMany({
      where: {
        ...(filter.type && (AuditEventTypes as readonly string[]).includes(filter.type) ? { type: filter.type } : {}),
        ...(filter.days ? { createdAt: { gte: subDays(new Date(), filter.days) } } : {}),
        ...(q ? { actorLabel: { contains: q, mode: "insensitive" } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { accessGrant: { select: { recipientKind: true, recipientName: true } } },
    });
  },

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  async saveMail(actor: UserActor, input: Omit<MailSettings, "passwordEnc"> & { password?: string | null }, meta?: RequestMeta) {
    await authorizationService.assertPlatformAdmin(actor);
    await platformSettingsService.saveMail(input, actor.userId);
    await auditService.record({
      type: "PLATFORM_SETTINGS_UPDATED",
      actor,
      resourceType: "PlatformSetting",
      resourceId: "mail",
      context: { provider: input.provider, host: input.host },
      meta,
    });
  },

  async saveSecurity(actor: UserActor, input: SecuritySettings, meta?: RequestMeta) {
    await authorizationService.assertPlatformAdmin(actor);
    await platformSettingsService.saveSecurity(input, actor.userId);
    await auditService.record({
      type: "PLATFORM_SETTINGS_UPDATED",
      actor,
      resourceType: "PlatformSetting",
      resourceId: "security",
      context: input,
      meta,
    });
  },

  async saveFeatures(actor: UserActor, input: FeatureSettings, meta?: RequestMeta) {
    await authorizationService.assertPlatformAdmin(actor);
    await platformSettingsService.saveFeatures(input, actor.userId);
    await auditService.record({
      type: "PLATFORM_SETTINGS_UPDATED",
      actor,
      resourceType: "PlatformSetting",
      resourceId: "features",
      context: input,
      meta,
    });
  },

  async resetSetting(actor: UserActor, key: "mail" | "security" | "features", meta?: RequestMeta) {
    await authorizationService.assertPlatformAdmin(actor);
    await platformSettingsService.resetToEnvironment(key);
    await auditService.record({
      type: "PLATFORM_SETTINGS_UPDATED",
      actor,
      resourceType: "PlatformSetting",
      resourceId: key,
      context: { resetToEnvironment: true },
      meta,
    });
  },

  async sendTestMail(actor: UserActor, to: string) {
    await authorizationService.assertPlatformAdmin(actor);
    const { value, source } = await platformSettingsService.mail();
    await mailer().send({
      to,
      subject: "Child Care Passport · prueba de correo / mail test",
      text: `Este es un correo de prueba enviado desde el panel de administración por ${actor.name}.\n\nProveedor: ${value.provider}${value.provider === "smtp" ? ` (${value.host}:${value.port})` : ""}\nOrigen de la configuración: ${source}\n\nThis is a test email sent from the admin panel.`,
    });
    return { provider: value.provider, source };
  },

  // ---------------------------------------------------------------------------
  // Demo dataset
  // ---------------------------------------------------------------------------

  async demoStatus(actor: Actor) {
    await authorizationService.assertPlatformAdmin(actor);
    const e = env();
    const [seeded, demoUsers, demoChildren] = await Promise.all([
      prisma.user.findFirst({ where: { email: DEMO_ACCOUNTS[0].email }, select: { id: true } }),
      prisma.user.count({ where: { isDemo: true } }),
      prisma.child.count({ where: { createdBy: { isDemo: true }, deletedAt: null } }),
    ]);
    return {
      enabled: e.SEED_DEMO && (e.NODE_ENV !== "production" || e.ALLOW_DEMO_SEED),
      seeded: Boolean(seeded),
      demoUsers,
      demoChildren,
      accounts: DEMO_ACCOUNTS,
      password: e.DEMO_PASSWORD,
    };
  },

  async seedDemo(actor: UserActor, meta?: RequestMeta): Promise<DemoSeedResult> {
    await authorizationService.assertPlatformAdmin(actor);
    const result = await runDemoSeed();
    if (result.status === "created") {
      await auditService.record({ type: "DEMO_SEEDED", actor, resourceType: "Demo", meta });
    }
    return result;
  },

  /** Removes every demo account and what they created (children, institutions, audit), then seeds again. */
  async resetDemo(actor: UserActor, meta?: RequestMeta): Promise<DemoSeedResult> {
    await authorizationService.assertPlatformAdmin(actor);
    const status = await this.demoStatus(actor);
    if (!status.enabled) throw new AppError("FEATURE_DISABLED", "Demo seeding is disabled on this deployment.");
    const demo = await prisma.user.findMany({ where: { isDemo: true }, select: { id: true, email: true } });
    if (demo.some((u) => u.id === actor.userId)) {
      throw new AppError("INVALID_STATE", "Sign in with a non-demo administrator account to reset the demo.");
    }
    const ids = demo.map((u) => u.id);
    if (ids.length) {
      await prisma.$transaction(async (tx) => {
        await tx.child.deleteMany({ where: { createdById: { in: ids } } });
        await tx.institution.deleteMany({ where: { createdById: { in: ids } } });
        await tx.auditEvent.deleteMany({ where: { actorUserId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
      });
    }
    await auditService.record({
      type: "DEMO_RESET",
      actor,
      resourceType: "Demo",
      context: { removedUsers: ids.length },
      meta,
    });
    return this.seedDemo(actor, meta);
  },
};
