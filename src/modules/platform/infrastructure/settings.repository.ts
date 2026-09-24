import { prisma } from "@/shared/db/prisma";
import type { Prisma } from "@/generated/prisma/client";

export const settingsRepository = {
  get(key: string) {
    return prisma.platformSetting.findUnique({ where: { key } });
  },

  list() {
    return prisma.platformSetting.findMany();
  },

  set(key: string, value: Record<string, unknown>, updatedById: string | null) {
    const json = value as Prisma.InputJsonValue;
    return prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: json, updatedById },
      update: { value: json, updatedById },
    });
  },

  remove(key: string) {
    return prisma.platformSetting.deleteMany({ where: { key } });
  },
};
