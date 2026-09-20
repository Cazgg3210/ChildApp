import { prisma } from "@/shared/db/prisma";
import type { AuthTokenType } from "@/generated/prisma/enums";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findFirst({ where: { email: email.toLowerCase(), deletedAt: null } });
  },

  findById(id: string) {
    return prisma.user.findFirst({ where: { id, deletedAt: null } });
  },

  create(data: {
    email: string;
    passwordHash: string;
    name: string;
    locale: string;
    timezone?: string;
    country?: string;
  }) {
    return prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash: data.passwordHash,
        name: data.name,
        locale: data.locale,
        timezone: data.timezone ?? "America/Mexico_City",
        country: data.country ?? "MX",
      },
    });
  },

  markEmailVerified(userId: string) {
    return prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
  },

  updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
  },

  updateProfile(userId: string, data: { name?: string; locale?: string; timezone?: string }) {
    return prisma.user.update({ where: { id: userId }, data });
  },

  createAuthToken(userId: string, type: AuthTokenType, tokenHash: string, expiresAt: Date) {
    return prisma.authToken.create({ data: { userId, type, tokenHash, expiresAt } });
  },

  findAuthToken(tokenHash: string, type: AuthTokenType) {
    return prisma.authToken.findFirst({ where: { tokenHash, type }, include: { user: true } });
  },

  consumeAuthToken(id: string) {
    return prisma.authToken.update({ where: { id }, data: { usedAt: new Date() } });
  },
};
