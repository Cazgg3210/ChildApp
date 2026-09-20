import { prisma } from "@/shared/db/prisma";
import { logger } from "@/shared/logging/logger";
import type { Prisma } from "@/generated/prisma/client";
import type { NotificationChannel, OutgoingNotification } from "../domain/types";

class InAppChannel implements NotificationChannel {
  readonly name = "in-app";
  async deliver(n: OutgoingNotification): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: n.userId,
        type: n.type,
        title: n.title,
        body: n.body,
        data: (n.data ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}

const channels: NotificationChannel[] = [new InAppChannel()];

export const notificationService = {
  /** Fan-out to every registered channel. Failures are logged, never thrown. */
  async notify(notification: OutgoingNotification): Promise<void> {
    await Promise.all(
      channels.map((c) =>
        c
          .deliver(notification)
          .catch((err) =>
            logger.error({ err, channel: c.name, type: notification.type }, "notification delivery failed"),
          ),
      ),
    );
  },

  async notifyMany(userIds: string[], notification: Omit<OutgoingNotification, "userId">): Promise<void> {
    await Promise.all([...new Set(userIds)].map((userId) => this.notify({ ...notification, userId })));
  },

  list(userId: string, limit = 50) {
    return prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
  },

  countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, readAt: null } });
  },

  async markAllRead(userId: string) {
    await prisma.notification.updateMany({ where: { userId, readAt: null }, data: { readAt: new Date() } });
  },

  async markRead(userId: string, id: string) {
    await prisma.notification.updateMany({ where: { id, userId }, data: { readAt: new Date() } });
  },
};
