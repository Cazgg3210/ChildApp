"use server";

import { z } from "zod";
import { requireUserActor } from "@/modules/identity/application/session";
import type { ActionState } from "@/shared/http/action-state";
import { toActionState } from "@/shared/http/action-errors";
import { PROFILE_SECTIONS } from "@/shared/domain/care-vocabulary";
import { aiService } from "../application/ai.service";
import type { ProposedItem } from "../domain/types";

const schema = z.object({
  childId: z.string().min(1),
  text: z.string().trim().min(3).max(4000),
  locale: z.string().default("es"),
  sections: z.array(z.enum(PROFILE_SECTIONS)).optional(),
});

export async function structureNotesAction(
  input: z.infer<typeof schema>,
): Promise<ActionState<{ items: ProposedItem[] }>> {
  try {
    const { actor } = await requireUserActor();
    const parsed = schema.parse(input);
    const items = await aiService.structure(actor, parsed.childId, {
      text: parsed.text,
      locale: parsed.locale,
      sections: parsed.sections,
    });
    return { ok: true, data: { items } };
  } catch (err) {
    return toActionState(err);
  }
}
