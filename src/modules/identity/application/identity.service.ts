import { addHours } from "date-fns";
import { AppError } from "@/shared/errors/app-error";
import { env } from "@/shared/config/env";
import { hashPassword, verifyPassword } from "@/shared/security/password";
import { generateSecureToken, hashToken } from "@/shared/security/tokens";
import { rateLimiter } from "@/shared/security/rate-limit";
import { auditService } from "@/modules/audit/application/audit.service";
import { systemActor } from "../domain/types";
import { userRepository } from "../infrastructure/user.repository";
import { mailer } from "../infrastructure/mailer";

const VERIFICATION_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

export interface RegisterInput {
  email: string;
  password: string;
  name: string;
  locale?: string;
  timezone?: string;
}

export const identityService = {
  async register(input: RegisterInput) {
    const email = input.email.trim().toLowerCase();
    const existing = await userRepository.findByEmail(email);
    if (existing) throw new AppError("CONFLICT", "An account with this email already exists.");

    const passwordHash = await hashPassword(input.password);
    const user = await userRepository.create({
      email,
      passwordHash,
      name: input.name.trim(),
      locale: input.locale ?? "es",
      timezone: input.timezone,
    });

    await auditService.record({
      type: "USER_REGISTERED",
      actor: { type: "user", userId: user.id, email: user.email, name: user.name },
      resourceType: "User",
      resourceId: user.id,
    });

    await this.sendEmailVerification(user.id);
    return user;
  },

  /**
   * Used by the Auth.js Credentials provider. Two limits: a global one per IP
   * and one per IP+email, so an attacker cannot lock a victim out by exhausting
   * a per-email bucket from elsewhere.
   */
  async authenticateWithPassword(email: string, password: string, ipAddress = "unknown") {
    const normalized = email.trim().toLowerCase();
    await rateLimiter.consume(`login:ip:${ipAddress}`, 60, 15 * 60 * 1000);
    await rateLimiter.consume(`login:${ipAddress}:${normalized}`, 10, 15 * 60 * 1000);
    const user = await userRepository.findByEmail(normalized);
    const ok = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !ok) {
      await auditService.record({ type: "LOGIN_FAILED", actor: systemActor, context: { email: normalized } });
      return null;
    }
    await rateLimiter.reset(`login:${ipAddress}:${normalized}`);
    await auditService.record({
      type: "LOGIN_SUCCEEDED",
      actor: { type: "user", userId: user.id, email: user.email, name: user.name },
      resourceType: "User",
      resourceId: user.id,
    });
    return user;
  },

  async sendEmailVerification(userId: string) {
    const user = await userRepository.findById(userId);
    if (!user) throw new AppError("NOT_FOUND", "User not found");
    if (user.emailVerifiedAt) return;
    const token = generateSecureToken();
    await userRepository.createAuthToken(
      user.id,
      "EMAIL_VERIFICATION",
      hashToken(token),
      addHours(new Date(), VERIFICATION_TTL_HOURS),
    );
    const url = `${env().APP_URL}/verify-email/${token}`;
    await mailer().send({
      to: user.email,
      subject: "Confirma tu correo / Confirm your email",
      text: `Hola ${user.name},\n\nConfirma tu correo abriendo este enlace (válido ${VERIFICATION_TTL_HOURS} h):\n${url}\n\nConfirm your email by opening this link (valid ${VERIFICATION_TTL_HOURS} h).`,
    });
  },

  async verifyEmail(token: string) {
    const record = await userRepository.findAuthToken(hashToken(token), "EMAIL_VERIFICATION");
    if (!record || record.usedAt) throw new AppError("INVALID_TOKEN", "This verification link is not valid.");
    if (record.expiresAt < new Date()) throw new AppError("TOKEN_EXPIRED", "This verification link has expired.");
    await userRepository.consumeAuthToken(record.id);
    await userRepository.markEmailVerified(record.userId);
    await auditService.record({
      type: "EMAIL_VERIFIED",
      actor: { type: "user", userId: record.user.id, email: record.user.email, name: record.user.name },
      resourceType: "User",
      resourceId: record.userId,
    });
    return record.user;
  },

  /** Always resolves successfully so that email existence cannot be probed. */
  async requestPasswordReset(email: string) {
    const normalized = email.trim().toLowerCase();
    await rateLimiter.consume(`reset:${normalized}`, 5, 60 * 60 * 1000);
    const user = await userRepository.findByEmail(normalized);
    if (!user) return;
    const token = generateSecureToken();
    await userRepository.createAuthToken(
      user.id,
      "PASSWORD_RESET",
      hashToken(token),
      addHours(new Date(), RESET_TTL_HOURS),
    );
    const url = `${env().APP_URL}/reset-password/${token}`;
    await mailer().send({
      to: user.email,
      subject: "Restablecer contraseña / Reset your password",
      text: `Hola ${user.name},\n\nPara restablecer tu contraseña abre este enlace (válido ${RESET_TTL_HOURS} h):\n${url}\n\nSi no lo solicitaste, ignora este mensaje.`,
    });
    await auditService.record({
      type: "PASSWORD_RESET_REQUESTED",
      actor: systemActor,
      resourceType: "User",
      resourceId: user.id,
    });
  },

  async resetPassword(token: string, newPassword: string) {
    const record = await userRepository.findAuthToken(hashToken(token), "PASSWORD_RESET");
    if (!record || record.usedAt) throw new AppError("INVALID_TOKEN", "This reset link is not valid.");
    if (record.expiresAt < new Date()) throw new AppError("TOKEN_EXPIRED", "This reset link has expired.");
    await userRepository.consumeAuthToken(record.id);
    await userRepository.updatePassword(record.userId, await hashPassword(newPassword));
    await auditService.record({
      type: "PASSWORD_RESET_COMPLETED",
      actor: { type: "user", userId: record.user.id, email: record.user.email, name: record.user.name },
      resourceType: "User",
      resourceId: record.userId,
    });
  },

  getUserById(id: string) {
    return userRepository.findById(id);
  },

  /**
   * Gate for actions that reach other people (sharing, inviting, creating an
   * institution). Off by default for local demos; REQUIRE_EMAIL_VERIFICATION=true
   * in production (docs/09-security-model.md).
   */
  async assertVerified(userId: string) {
    if (!env().REQUIRE_EMAIL_VERIFICATION) return;
    const user = await userRepository.findById(userId);
    if (!user?.emailVerifiedAt) throw new AppError("EMAIL_NOT_VERIFIED", "Confirm your email to continue.");
  },

  updateProfile(userId: string, data: { name?: string; locale?: string; timezone?: string }) {
    return userRepository.updateProfile(userId, data);
  },
};
