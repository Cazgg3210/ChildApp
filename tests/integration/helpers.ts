import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { userActor, type UserActor } from "@/modules/identity/domain/types";
import { childrenService } from "@/modules/children/application/children.service";
import { createdUserIds } from "./setup";

export async function makeUser(name: string): Promise<UserActor> {
  const user = await prisma.user.create({
    data: {
      email: `${name.toLowerCase()}-${randomUUID()}@test.local`,
      name,
      passwordHash: "x",
      emailVerifiedAt: new Date(),
      isDemo: true,
    },
  });
  createdUserIds.push(user.id);
  return userActor({
    id: user.id,
    email: user.email,
    name: user.name,
    locale: "es",
    timezone: "UTC",
    emailVerifiedAt: new Date(),
    isDemo: true,
    isPlatformAdmin: false,
  });
}

export async function makeChildWithProfile(guardian: UserActor, firstName = "Mateo") {
  return childrenService.create(guardian, {
    firstName,
    lastName: "Test",
    dateOfBirth: new Date("2022-03-14"),
    initialItems: [
      { section: "EMERGENCY", itemType: "CONTACT", label: "Mom", data: { phone: "5551234" } },
      { section: "HEALTH", itemType: "ALLERGY", label: "Peanut", data: { severity: "severe" } },
      { section: "HEALTH", itemType: "CONDITION", label: "Mild asthma" },
      { section: "SLEEP", itemType: "SCHEDULE", label: "Nap", data: { time: "14:00" } },
      { section: "BATHROOM", itemType: "DIAPER", label: "Diaper" },
      { section: "PLAY", itemType: "TOY", label: "Dinosaurs" },
    ],
  });
}

export async function expectAppError<T>(promise: Promise<T>, code: string) {
  try {
    await promise;
  } catch (err) {
    const e = err as { code?: string; message?: string };
    if (e.code !== code) throw new Error(`Expected AppError ${code}, got ${e.code ?? "no code"}: ${e.message}`);
    return;
  }
  throw new Error(`Expected AppError ${code}, but the call succeeded`);
}
