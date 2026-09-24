import { AppError } from "@/shared/errors/app-error";
import { env } from "@/shared/config/env";
import { isFeatureEnabled } from "@/shared/config/feature-flags";
import { logger } from "@/shared/logging/logger";
import type { Actor } from "@/modules/identity/domain/types";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import type { AIProvider, ProposedItem, StructureRequest } from "../domain/types";
import { HeuristicAIProvider } from "../infrastructure/heuristic.provider";

/**
 * Provider registry. Only the heuristic provider ships in the MVP; hosted
 * providers plug in here (see docs/15-roadmap.md) without touching callers.
 */
function resolveProvider(): AIProvider {
  const wanted = env().AI_PROVIDER;
  if (wanted !== "heuristic") {
    logger.warn({ provider: wanted }, "AI provider not implemented in this build; using heuristic provider");
  }
  return new HeuristicAIProvider();
}

let provider: AIProvider | undefined;

export const aiService = {
  provider(): AIProvider {
    if (!provider) provider = resolveProvider();
    return provider;
  },

  /** Structures free text into proposed profile items. The guardian always reviews before saving. */
  async structure(actor: Actor, childId: string, request: StructureRequest): Promise<ProposedItem[]> {
    if (!(await isFeatureEnabled("AI_PROFILE_ASSISTANT"))) throw new AppError("FEATURE_DISABLED");
    await authorizationService.assert(actor, "profile.update", childId);
    const text = request.text.trim().slice(0, 4000);
    if (!text) return [];
    return this.provider().structureCareNotes({ ...request, text });
  },
};
