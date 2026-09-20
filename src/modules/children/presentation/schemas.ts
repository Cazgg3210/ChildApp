import { z } from "zod";
import { PROFILE_SECTIONS } from "@/shared/domain/care-vocabulary";

export const profileItemInputSchema = z.object({
  section: z.enum(PROFILE_SECTIONS),
  itemType: z.string().min(1).max(40),
  label: z.string().trim().min(1, "Required").max(120),
  details: z.string().trim().max(2000).optional().nullable(),
  data: z.record(z.string(), z.unknown()).optional().nullable(),
  criticality: z.enum(["CRITICAL", "IMPORTANT", "INFORMATIONAL"]).optional(),
  provenance: z.enum(["SELF_DECLARED", "OBSERVED", "DOCUMENTED", "VERIFIED"]).optional(),
  sourceType: z.enum(["GUARDIAN", "FAMILY", "CAREGIVER", "INSTITUTION", "PROFESSIONAL", "DOCUMENT"]).optional(),
  sourceLabel: z.string().trim().max(120).optional().nullable(),
});

export const childBasicsSchema = z.object({
  firstName: z.string().trim().min(1, "Required").max(60),
  lastName: z.string().trim().min(1, "Required").max(80),
  preferredName: z.string().trim().max(60).optional().nullable(),
  dateOfBirth: z.coerce.date().refine((d) => d <= new Date() && d > new Date("1990-01-01"), "Enter a valid date"),
  primaryLanguage: z.string().trim().min(2).max(10).default("es"),
  secondaryLanguages: z.array(z.string().trim().min(1).max(30)).max(5).default([]),
});

export const createChildSchema = childBasicsSchema.extend({
  initialItems: z.array(profileItemInputSchema).max(40).default([]),
});

export const addGuardianSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(["OWNER", "CO_GUARDIAN"]).default("CO_GUARDIAN"),
  relationshipLabel: z.string().trim().max(60).optional(),
});

export type CreateChildPayload = z.infer<typeof createChildSchema>;
export type ProfileItemPayload = z.infer<typeof profileItemInputSchema>;
