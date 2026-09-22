import QRCode from "qrcode";
import { prisma } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import { env, shareBaseUrl } from "@/shared/config/env";
import { generateSecureToken, hashToken, signValue, verifySignedValue } from "@/shared/security/tokens";
import { hashPin, verifyPin } from "@/shared/security/password";
import { rateLimiter } from "@/shared/security/rate-limit";
import type { RequestMeta } from "@/shared/security/request-context";
import { CRITICAL_CATEGORIES, type Capability, type DataCategory } from "@/shared/domain/care-vocabulary";
import type { Actor, UserActor } from "@/modules/identity/domain/types";
import { authorizationService, toGrantView } from "@/modules/authorization/application/authorization.service";
import {
  effectiveGrantStatus,
  evaluateGrantValidity,
  MAX_PIN_ATTEMPTS,
  visibleCategories,
} from "@/modules/authorization/domain/policy";
import { auditService } from "@/modules/audit/application/audit.service";
import { analyticsService } from "@/modules/analytics/application/analytics.service";
import { notificationService } from "@/modules/notifications/application/notification.service";
import { consentService, purposeFor } from "@/modules/consent/application/consent.service";
import { institutionRepository } from "@/modules/institutions/infrastructure/institution.repository";
import { identityService } from "@/modules/identity/application/identity.service";
import type { CareShareInput } from "../domain/share-input";
import { sharingRepository, type GrantWithRelations } from "../infrastructure/sharing.repository";

export type { GrantWithRelations };

export interface CreatedShare {
  grant: GrantWithRelations;
  /** Plaintext token: returned exactly once, never persisted. */
  token: string | null;
  url: string | null;
  qrDataUrl: string | null;
}

export function shareUrl(token: string): string {
  return `${shareBaseUrl()}/s/${token}`;
}

export async function qrFor(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 360,
    errorCorrectionLevel: "M",
    color: { dark: "#1f2a2a", light: "#ffffff" },
  });
}

const PIN_COOKIE_TTL_MS = 12 * 60 * 60 * 1000;

export const sharingService = {
  /**
   * Care Share: creates the AccessGrant (ABAC attributes), the Consent ledger
   * row and — for people — a ShareLink whose token only exists in the
   * returned URL/QR. Institutions get a PENDING relationship instead.
   */
  async create(actor: UserActor, childId: string, input: CareShareInput, meta?: RequestMeta): Promise<CreatedShare> {
    await authorizationService.assert(actor, "share.create", childId);
    await identityService.assertVerified(actor.userId);
    const now = new Date();
    const startsAt = input.startsAt ?? now;
    const expiresAt = input.expiresAt ?? null;
    if (expiresAt && expiresAt <= now) throw new AppError("VALIDATION_ERROR", "Expiration must be in the future.");

    const isInstitution = input.recipientKind === "INSTITUTION";
    let institution: { id: string; name: string } | null = null;
    if (isInstitution) {
      const found = await institutionRepository.findByInviteCode(input.institutionCode ?? "");
      if (!found) throw new AppError("NOT_FOUND", "Institution not found for that code.");
      const existing = await prisma.childInstitution.findUnique({
        where: { childId_institutionId: { childId, institutionId: found.id } },
      });
      if (existing && (existing.status === "ACTIVE" || existing.status === "PENDING")) {
        throw new AppError("CONFLICT", "This child is already shared with that institution.");
      }
      institution = { id: found.id, name: found.name };
    }

    const token = isInstitution ? null : generateSecureToken();
    const pinHash = input.pin ? await hashPin(input.pin) : null;
    const categories = [...new Set<DataCategory>(["IDENTITY", ...input.dataCategories])];

    const grant = await prisma.$transaction(async (tx) => {
      const created = await sharingRepository.createGrant(
        {
          childId,
          grantedById: actor.userId,
          subjectType: isInstitution ? "INSTITUTION" : "LINK",
          subjectInstitutionId: institution?.id ?? null,
          recipientKind: input.recipientKind,
          recipientName: institution?.name ?? input.recipientName,
          recipientEmail: input.recipientEmail ?? null,
          dataCategories: categories,
          capabilities: input.capabilities,
          startsAt,
          expiresAt,
          status: isInstitution ? "PENDING" : "ACTIVE",
          note: input.note ?? null,
        },
        tx,
      );
      await consentService.record(
        {
          childId,
          guardianId: actor.userId,
          accessGrantId: created.id,
          recipientType: input.recipientKind,
          recipientLabel: created.recipientName,
          purpose: purposeFor(input.recipientKind),
          dataCategories: categories,
          startsAt,
          expiresAt,
        },
        tx,
      );
      if (token) {
        await sharingRepository.createShareLink(
          { accessGrantId: created.id, tokenHash: hashToken(token), pinHash, maxUses: input.singleUse ? 1 : null },
          tx,
        );
      }
      if (institution) {
        // Remove a previous ended/revoked relationship so the unique pair can be re-created.
        await tx.childInstitution.deleteMany({ where: { childId, institutionId: institution.id } });
        await tx.childInstitution.create({
          data: { childId, institutionId: institution.id, accessGrantId: created.id, status: "PENDING" },
        });
      }
      return created;
    });

    await auditService.record({
      type: "ACCESS_GRANTED",
      actor,
      childId,
      accessGrantId: grant.id,
      institutionId: institution?.id,
      resourceType: "AccessGrant",
      resourceId: grant.id,
      dataCategories: categories,
      context: { recipientKind: input.recipientKind, expiresAt, pin: Boolean(pinHash), singleUse: input.singleUse },
      meta,
    });
    await analyticsService.track("SHARE_CREATED", {
      userId: actor.userId,
      childId,
      institutionId: institution?.id,
      props: { kind: input.recipientKind },
    });

    if (institution) {
      const admins = await prisma.institutionMember.findMany({
        where: { institutionId: institution.id, role: "ADMIN" },
        select: { userId: true },
      });
      const child = await prisma.child.findUnique({ where: { id: childId }, select: { firstName: true } });
      await notificationService.notifyMany(
        admins.map((a) => a.userId),
        {
          type: "INSTITUTION_REQUEST",
          title: `${actor.name} · ${child?.firstName ?? ""}`,
          data: { childId, grantId: grant.id, actorName: actor.name, childName: child?.firstName ?? "" },
        },
      );
    }

    const full = await sharingRepository.findGrant(grant.id);
    const url = token ? shareUrl(token) : null;
    return { grant: full!, token, url, qrDataUrl: url ? await qrFor(url) : null };
  },

  /** Rotates the link token: the previous URL/QR stops working immediately. */
  async rotateLink(actor: Actor, grantId: string, meta?: RequestMeta): Promise<CreatedShare> {
    const grant = await sharingRepository.findGrant(grantId);
    if (!grant || !grant.shareLink) throw new AppError("NOT_FOUND", "Share not found");
    await authorizationService.assert(actor, "share.create", grant.childId);
    if (grant.status !== "ACTIVE") throw new AppError("INVALID_STATE", "Only active shares can be regenerated.");
    const token = generateSecureToken();
    await prisma.shareLink.update({
      where: { id: grant.shareLink.id },
      data: { tokenHash: hashToken(token), useCount: 0, pinAttempts: 0, status: "ACTIVE" },
    });
    await auditService.record({
      type: "ACCESS_GRANTED",
      actor,
      childId: grant.childId,
      accessGrantId: grant.id,
      resourceType: "ShareLink",
      resourceId: grant.shareLink.id,
      context: { rotated: true },
      meta,
    });
    const url = shareUrl(token);
    return { grant: (await sharingRepository.findGrant(grantId))!, token, url, qrDataUrl: await qrFor(url) };
  },

  async revoke(actor: Actor, grantId: string, reason = "GUARDIAN_REVOKED", meta?: RequestMeta) {
    const grant = await sharingRepository.findGrant(grantId);
    if (!grant) throw new AppError("NOT_FOUND", "Share not found");
    await authorizationService.assert(actor, "share.revoke", grant.childId);
    if (grant.status === "REVOKED") return grant;
    await sharingRepository.revokeGrant(grantId, actor.type === "user" ? actor.userId : null, reason);
    await auditService.record({
      type: "ACCESS_REVOKED",
      actor,
      childId: grant.childId,
      accessGrantId: grant.id,
      institutionId: grant.subjectInstitutionId,
      resourceType: "AccessGrant",
      resourceId: grant.id,
      context: { reason },
      meta,
    });
    if (grant.subjectInstitutionId) {
      const members = await prisma.institutionMember.findMany({
        where: { institutionId: grant.subjectInstitutionId },
        select: { userId: true },
      });
      await notificationService.notifyMany(
        members.map((m) => m.userId),
        {
          type: "ACCESS_REVOKED",
          title: grant.recipientName,
          data: { childId: grant.childId, institutionName: grant.recipientName },
        },
      );
    }
    return (await sharingRepository.findGrant(grantId))!;
  },

  async listForChild(actor: Actor, childId: string, now = new Date()) {
    await authorizationService.assert(actor, "share.revoke", childId);
    const grants = await sharingRepository.listGrantsForChild(childId);
    const acks = await sharingRepository.lastAcknowledgementsForGrants(grants.map((g) => g.id));
    return grants.map((g) => ({
      ...g,
      effectiveStatus: effectiveGrantStatus(toGrantView(g), now),
      lastAcknowledgement: acks.find((a) => a.accessGrantId === g.id) ?? null,
    }));
  },

  async getForGuardian(actor: Actor, grantId: string) {
    const grant = await sharingRepository.findGrant(grantId);
    if (!grant) throw new AppError("NOT_FOUND", "Share not found");
    await authorizationService.assert(actor, "share.revoke", grant.childId);
    return { ...grant, effectiveStatus: effectiveGrantStatus(toGrantView(grant), new Date()) };
  },

  /** "Who can see this section?" — active grants that include the category. */
  async visibilityFor(childId: string, category: DataCategory, now = new Date()) {
    const grants = await sharingRepository.listGrantsForChild(childId);
    return grants
      .filter((g) => evaluateGrantValidity(toGrantView(g), now).valid)
      .map((g) => ({
        id: g.id,
        recipientName: g.recipientName,
        recipientKind: g.recipientKind,
        canSee: visibleCategories(g).includes(category),
      }));
  },

  // ---------------------------------------------------------------------------
  // Link resolution (caregiver side)
  // ---------------------------------------------------------------------------

  /**
   * Resolves a share token to its grant without counting a use. Returns the
   * denial reason instead of throwing so the Care Pass can render a friendly page.
   */
  async resolveToken(token: string, opts: { now?: Date; allowExhausted?: boolean } = {}) {
    const now = opts.now ?? new Date();
    if (!token || token.length < 20 || token.length > 128)
      return { ok: false as const, reason: "INVALID_TOKEN" as const };
    const link = await sharingRepository.findGrantByTokenHash(hashToken(token));
    if (!link || link.accessGrant.child.deletedAt) return { ok: false as const, reason: "INVALID_TOKEN" as const };
    const grant = link.accessGrant;
    let validity = evaluateGrantValidity(toGrantView({ ...grant, shareLink: link }), now);
    // A single-use link stays readable on the device that opened it (seen cookie), until it expires or is revoked.
    if (!validity.valid && validity.reason === "ACCESS_EXHAUSTED" && opts.allowExhausted) validity = { valid: true };
    if (!validity.valid) {
      await auditService.record({
        type: "SHARE_LINK_DENIED",
        actor: {
          type: "link",
          grantId: grant.id,
          linkId: link.id,
          childId: grant.childId,
          recipientName: grant.recipientName,
        },
        childId: grant.childId,
        resourceType: "ShareLink",
        resourceId: link.id,
        context: { reason: validity.reason },
      });
      return { ok: false as const, reason: validity.reason };
    }
    return {
      ok: true as const,
      link,
      grant,
      child: grant.child,
      categories: visibleCategories(grant),
      capabilities: grant.capabilities as Capability[],
    };
  },

  requiresPin(link: { pinHash: string | null }): boolean {
    return Boolean(link.pinHash);
  },

  pinCookieName(linkId: string): string {
    return `cp_${linkId}`;
  },

  seenCookieName(linkId: string): string {
    return `cps_${linkId}`;
  },

  issueSeenCookie(linkId: string): string {
    return signValue(`${linkId}|${Date.now() + PIN_COOKIE_TTL_MS}`, env().AUTH_SECRET);
  },

  /** Validates a signed link cookie (PIN or seen) previously issued for this link. */
  isPinCookieValid(linkId: string, cookieValue: string | undefined): boolean {
    if (!cookieValue) return false;
    const value = verifySignedValue(cookieValue, env().AUTH_SECRET);
    if (!value) return false;
    const [id, expires] = value.split("|");
    return id === linkId && Number(expires) > Date.now();
  },

  async verifyPin(
    token: string,
    pin: string,
    meta?: RequestMeta,
  ): Promise<
    | { ok: true; cookieValue: string; maxAge: number }
    | { ok: false; reason: "PIN_INVALID" | "PIN_LOCKED"; remaining: number }
  > {
    const resolved = await this.resolveToken(token);
    if (!resolved.ok) throw new AppError(resolved.reason);
    const { link, grant } = resolved;
    if (!link.pinHash) return { ok: true, cookieValue: this.issuePinCookie(link.id), maxAge: PIN_COOKIE_TTL_MS / 1000 };
    await rateLimiter.consume(`pin:${link.id}:${meta?.ipAddress ?? "unknown"}`, 10, 15 * 60 * 1000);
    const actor: Actor = {
      type: "link",
      grantId: grant.id,
      linkId: link.id,
      childId: grant.childId,
      recipientName: grant.recipientName,
    };
    if (await verifyPin(pin, link.pinHash)) {
      await sharingRepository.resetPinAttempts(link.id);
      return { ok: true, cookieValue: this.issuePinCookie(link.id), maxAge: PIN_COOKIE_TTL_MS / 1000 };
    }
    const updated = await sharingRepository.incrementPinAttempts(link.id);
    const locked = updated.pinAttempts >= MAX_PIN_ATTEMPTS;
    await auditService.record({
      type: locked ? "PIN_LOCKED" : "PIN_FAILED",
      actor,
      childId: grant.childId,
      resourceType: "ShareLink",
      resourceId: link.id,
      meta,
    });
    if (locked) return { ok: false, reason: "PIN_LOCKED", remaining: 0 };
    return { ok: false, reason: "PIN_INVALID", remaining: MAX_PIN_ATTEMPTS - updated.pinAttempts };
  },

  issuePinCookie(linkId: string): string {
    return signValue(`${linkId}|${Date.now() + PIN_COOKIE_TTL_MS}`, env().AUTH_SECRET);
  },

  /**
   * Consume-and-exchange for a link opening: validates, atomically spends one
   * use (single-use links cannot be opened twice, even concurrently), audits
   * what the viewer can see and returns the signed "seen" cookie value that
   * lets this device keep reading the pass.
   */
  async consumeOpen(token: string, meta?: RequestMeta) {
    const resolved = await this.resolveToken(token);
    if (!resolved.ok) return resolved;
    const { link, grant, child } = resolved;
    const actor: Actor = { type: "link", grantId: grant.id, linkId: link.id, childId: child.id, recipientName: grant.recipientName };
    const consumed = await sharingRepository.consumeLinkUse(link.id);
    if (!consumed) {
      await auditService.record({ type: "SHARE_LINK_DENIED", actor, childId: child.id, resourceType: "ShareLink", resourceId: link.id, context: { reason: "ACCESS_EXHAUSTED" }, meta });
      return { ok: false as const, reason: "ACCESS_EXHAUSTED" as const };
    }
    await this.auditOpen(link.id, actor, child.id, resolved.categories, meta);
    return { ok: true as const, linkId: link.id, seenCookie: this.issueSeenCookie(link.id), maxAge: PIN_COOKIE_TTL_MS / 1000 };
  },

  /** Audit trail for an opening: link opened + what categories were exposed. */
  async auditOpen(linkId: string, actor: Actor, childId: string, categories: DataCategory[], meta?: RequestMeta) {
    const critical = categories.some((c) => CRITICAL_CATEGORIES.includes(c));
    await auditService.record({
      type: critical ? "CRITICAL_DATA_VIEWED" : "PROFILE_VIEWED",
      actor,
      childId,
      resourceType: "ChildProfile",
      resourceId: childId,
      dataCategories: categories,
      meta,
    });
    await auditService.record({
      type: "SHARE_LINK_OPENED",
      actor,
      childId,
      resourceType: "ShareLink",
      resourceId: linkId,
      dataCategories: categories,
      meta,
    });
    await analyticsService.track("SHARE_OPENED", { childId });
  },

  expireDueGrants: () => sharingRepository.expireDueGrants(),
};
