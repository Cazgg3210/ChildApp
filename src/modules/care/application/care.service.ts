import { prisma } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import type { RequestMeta } from "@/shared/security/request-context";
import type { DataCategory } from "@/shared/domain/care-vocabulary";
import type { CareEventType } from "@/generated/prisma/enums";
import type { Prisma } from "@/generated/prisma/client";
import type { Actor } from "@/modules/identity/domain/types";
import { actorLabel } from "@/modules/identity/domain/types";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { analyticsService } from "@/modules/analytics/application/analytics.service";
import { notificationService } from "@/modules/notifications/application/notification.service";
import { profileService } from "@/modules/profiles/application/profile.service";
import type { ProfileChange } from "@/modules/profiles/domain/versioning";

const sessionInclude = {
  events: { orderBy: { occurredAt: "asc" as const } },
  child: { select: { id: true, firstName: true, preferredName: true } },
};

async function guardianIds(childId: string): Promise<string[]> {
  const rows = await prisma.childGuardian.findMany({ where: { childId }, select: { userId: true } });
  return rows.map((r) => r.userId);
}

async function childLabel(childId: string): Promise<string> {
  const c = await prisma.child.findUnique({ where: { id: childId }, select: { firstName: true, preferredName: true } });
  return c?.preferredName ?? c?.firstName ?? "";
}

export const careService = {
  /**
   * "I have reviewed the critical care information." Records who, when, from
   * which care session and which profile version — the anchor for change detection.
   */
  async acknowledge(
    actor: Actor,
    childId: string,
    input: { actorName?: string; careSessionId?: string | null },
    meta?: RequestMeta,
  ) {
    const access = await authorizationService.assert(actor, "acknowledge", childId);
    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId }, select: { profileVersion: true } });
    const grantId = access.via === "guardian" ? null : access.grant.id;
    const actorName = input.actorName?.trim() || actorLabel(actor);
    const ack = await prisma.acknowledgement.create({
      data: {
        childId,
        accessGrantId: grantId,
        careSessionId: input.careSessionId ?? null,
        actorUserId: actor.type === "user" ? actor.userId : null,
        actorName,
        profileVersion: child.profileVersion,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
      },
    });
    if (input.careSessionId) {
      await prisma.careEvent.create({ data: { careSessionId: input.careSessionId, type: "INFO_REVIEWED" } });
    }
    await auditService.record({
      type: "ACKNOWLEDGEMENT_COMPLETED",
      actor,
      childId,
      accessGrantId: grantId,
      careSessionId: input.careSessionId ?? undefined,
      institutionId: access.via === "institution" ? access.institutionId : undefined,
      resourceType: "Acknowledgement",
      resourceId: ack.id,
      context: { profileVersion: child.profileVersion, actorName },
      meta,
    });
    await analyticsService.track("ACKNOWLEDGEMENT_COMPLETED", {
      childId,
      userId: actor.type === "user" ? actor.userId : null,
    });
    await notificationService.notifyMany(await guardianIds(childId), {
      type: "ACKNOWLEDGEMENT_COMPLETED",
      title: `${actorName} · ${await childLabel(childId)}`,
      data: { childId, acknowledgementId: ack.id, actorName, childName: await childLabel(childId) },
    });
    return ack;
  },

  async lastAcknowledgement(childId: string, opts: { grantId?: string | null; userId?: string | null }) {
    return prisma.acknowledgement.findFirst({
      where: {
        childId,
        ...(opts.grantId ? { accessGrantId: opts.grantId } : {}),
        ...(opts.userId ? { actorUserId: opts.userId } : {}),
      },
      orderBy: { acknowledgedAt: "desc" },
    });
  },

  /** "What's changed since you last reviewed?" for a given viewer. */
  async changesSinceLastReview(
    childId: string,
    viewer: { grantId?: string | null; userId?: string | null },
    categories: DataCategory[],
  ): Promise<{ since: Date; changes: ProfileChange[] } | null> {
    const last = await this.lastAcknowledgement(childId, viewer);
    if (!last) return null;
    const changes = await profileService.changesSince(childId, last.profileVersion, categories);
    return { since: last.acknowledgedAt, changes };
  },

  async startSession(
    actor: Actor,
    childId: string,
    input: { caregiverName?: string; expectedEndAt?: Date | null },
    meta?: RequestMeta,
  ) {
    const access = await authorizationService.assert(actor, "care_session.run", childId);
    const grantId = access.via === "guardian" ? null : access.grant.id;
    const existing = await prisma.careSession.findFirst({
      where: {
        childId,
        status: "ACTIVE",
        ...(grantId
          ? { accessGrantId: grantId }
          : { caregiverUserId: actor.type === "user" ? actor.userId : undefined }),
      },
    });
    if (existing) return prisma.careSession.findUniqueOrThrow({ where: { id: existing.id }, include: sessionInclude });
    const child = await prisma.child.findUniqueOrThrow({ where: { id: childId }, select: { profileVersion: true } });
    const caregiverName = input.caregiverName?.trim() || actorLabel(actor);
    const session = await prisma.careSession.create({
      data: {
        childId,
        accessGrantId: grantId,
        caregiverUserId: actor.type === "user" ? actor.userId : null,
        caregiverName,
        expectedEndAt: input.expectedEndAt ?? null,
        profileVersionAtStart: child.profileVersion,
        events: { create: { type: "SESSION_STARTED" } },
      },
      include: sessionInclude,
    });
    await auditService.record({
      type: "CARE_SESSION_STARTED",
      actor,
      childId,
      accessGrantId: grantId,
      careSessionId: session.id,
      institutionId: access.via === "institution" ? access.institutionId : undefined,
      resourceType: "CareSession",
      resourceId: session.id,
      meta,
    });
    await analyticsService.track("CARE_SESSION_CREATED", { childId });
    await notificationService.notifyMany(await guardianIds(childId), {
      type: "CARE_SESSION_STARTED",
      title: `${caregiverName} · ${await childLabel(childId)}`,
      data: { childId, careSessionId: session.id, actorName: caregiverName, childName: await childLabel(childId) },
    });
    return session;
  },

  async getSession(actor: Actor, sessionId: string) {
    const session = await prisma.careSession.findUnique({ where: { id: sessionId }, include: sessionInclude });
    if (!session) throw new AppError("NOT_FOUND", "Care session not found");
    const decision = await authorizationService.can(actor, "care_session.read", session.childId);
    if (!decision.allowed) {
      // Non-guardians may only see sessions they run themselves.
      const own = await authorizationService.assert(actor, "care_session.run", session.childId);
      const ownsIt =
        own.via === "guardian" ||
        session.accessGrantId === own.grant.id ||
        (actor.type === "user" && session.caregiverUserId === actor.userId);
      if (!ownsIt) throw new AppError("ACCESS_DENIED");
    }
    return session;
  },

  async activeSessionFor(childId: string, viewer: { grantId?: string | null; userId?: string | null }) {
    return prisma.careSession.findFirst({
      where: {
        childId,
        status: "ACTIVE",
        ...(viewer.grantId
          ? { accessGrantId: viewer.grantId }
          : viewer.userId
            ? { caregiverUserId: viewer.userId }
            : { id: "__none__" }),
      },
      include: sessionInclude,
      orderBy: { startedAt: "desc" },
    });
  },

  async recordEvent(
    actor: Actor,
    sessionId: string,
    input: { type: CareEventType; note?: string | null; occurredAt?: Date; data?: Record<string, unknown> | null },
    meta?: RequestMeta,
  ) {
    const session = await this.getSession(actor, sessionId);
    if (session.status !== "ACTIVE") throw new AppError("INVALID_STATE", "This care session has ended.");
    if (input.type === "SESSION_STARTED" || input.type === "SESSION_ENDED" || input.type === "INFO_REVIEWED")
      throw new AppError("VALIDATION_ERROR", "Reserved event type.");
    await authorizationService.assert(actor, "care_session.run", session.childId);
    const event = await prisma.careEvent.create({
      data: {
        careSessionId: sessionId,
        type: input.type,
        note: input.note?.trim() || null,
        occurredAt: input.occurredAt ?? new Date(),
        data: (input.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
    await auditService.record({
      type: "CARE_EVENT_RECORDED",
      actor,
      childId: session.childId,
      accessGrantId: session.accessGrantId,
      careSessionId: sessionId,
      resourceType: "CareEvent",
      resourceId: event.id,
      context: { eventType: input.type },
      meta,
    });
    return event;
  },

  async endSession(actor: Actor, sessionId: string, meta?: RequestMeta) {
    const session = await this.getSession(actor, sessionId);
    if (session.status !== "ACTIVE") return session;
    await authorizationService.assert(actor, "care_session.run", session.childId);
    const now = new Date();
    const ended = await prisma.careSession.update({
      where: { id: sessionId },
      data: { status: "ENDED", endedAt: now, events: { create: { type: "SESSION_ENDED", occurredAt: now } } },
      include: sessionInclude,
    });
    await auditService.record({
      type: "CARE_SESSION_ENDED",
      actor,
      childId: session.childId,
      accessGrantId: session.accessGrantId,
      careSessionId: sessionId,
      resourceType: "CareSession",
      resourceId: sessionId,
      meta,
    });
    await notificationService.notifyMany(await guardianIds(session.childId), {
      type: "CARE_SESSION_ENDED",
      title: `${session.caregiverName} · ${await childLabel(session.childId)}`,
      data: {
        childId: session.childId,
        careSessionId: sessionId,
        actorName: session.caregiverName,
        childName: await childLabel(session.childId),
      },
    });
    return ended;
  },

  async listSessionsForChild(actor: Actor, childId: string, limit = 30) {
    await authorizationService.assert(actor, "care_session.read", childId);
    return prisma.careSession.findMany({
      where: { childId },
      include: sessionInclude,
      orderBy: { startedAt: "desc" },
      take: limit,
    });
  },
};

export type CareSessionWithEvents = Awaited<ReturnType<typeof careService.startSession>>;
