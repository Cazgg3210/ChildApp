import { prisma } from "@/shared/db/prisma";
import { logger } from "@/shared/logging/logger";
import type { Prisma } from "@/generated/prisma/client";

export const ProductEvents = [
  "PROFILE_CREATED",
  "PROFILE_COMPLETED",
  "SHARE_CREATED",
  "SHARE_OPENED",
  "ACKNOWLEDGEMENT_COMPLETED",
  "CARE_SESSION_CREATED",
  "INSTITUTION_CONNECTED",
  "PROFILE_UPDATED",
  "CRITICAL_CHANGE",
] as const;

export type ProductEventName = (typeof ProductEvents)[number];

/** Product metrics (docs/01-product-vision.md). Never contains profile content. */
export const analyticsService = {
  async track(
    name: ProductEventName,
    ctx: {
      userId?: string | null;
      childId?: string | null;
      institutionId?: string | null;
      props?: Record<string, unknown>;
    } = {},
  ): Promise<void> {
    try {
      await prisma.productEvent.create({
        data: {
          name,
          userId: ctx.userId ?? null,
          childId: ctx.childId ?? null,
          institutionId: ctx.institutionId ?? null,
          props: (ctx.props ?? undefined) as Prisma.InputJsonValue | undefined,
        },
      });
    } catch (err) {
      logger.warn({ err, name }, "product event not recorded");
    }
  },
};
