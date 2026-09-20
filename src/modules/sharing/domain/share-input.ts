import { z } from "zod";
import { CAPABILITIES, DATA_CATEGORIES, RECIPIENT_KINDS } from "@/shared/domain/care-vocabulary";

/** Input contract for creating a Care Share (used by Server Actions and /api/v1). */
export const careShareInputSchema = z
  .object({
    recipientKind: z.enum(RECIPIENT_KINDS),
    recipientName: z.string().trim().min(1, "Required").max(120),
    recipientEmail: z.string().trim().toLowerCase().email().optional().nullable(),
    institutionCode: z.string().trim().max(20).optional().nullable(),
    dataCategories: z.array(z.enum(DATA_CATEGORIES)).min(1, "Select at least one category"),
    capabilities: z.array(z.enum(CAPABILITIES)).default([]),
    startsAt: z.coerce.date().optional(),
    expiresAt: z.coerce.date().optional().nullable(),
    pin: z
      .string()
      .trim()
      .regex(/^\d{4,6}$/, "PIN must be 4 to 6 digits")
      .optional()
      .nullable(),
    singleUse: z.boolean().default(false),
    note: z.string().trim().max(500).optional().nullable(),
  })
  .refine((v) => !v.expiresAt || !v.startsAt || v.expiresAt > v.startsAt, {
    message: "Expiration must be after start",
    path: ["expiresAt"],
  })
  .refine((v) => v.recipientKind !== "INSTITUTION" || (v.institutionCode && v.institutionCode.length > 0), {
    message: "Institution code is required",
    path: ["institutionCode"],
  });

export type CareShareInput = z.infer<typeof careShareInputSchema>;
