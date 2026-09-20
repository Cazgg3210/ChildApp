import type { ProfileSectionValue } from "@/shared/domain/care-vocabulary";

export interface ProposedItem {
  section: ProfileSectionValue;
  itemType: string;
  label: string;
  details?: string | null;
  data?: Record<string, unknown> | null;
  /** 0..1 — the UI always asks the guardian to review before saving. */
  confidence: number;
}

export interface StructureRequest {
  text: string;
  locale: string;
  /** Optional hint to restrict proposals to the sections on screen. */
  sections?: ProfileSectionValue[];
}

/**
 * Provider abstraction. The assistant only structures what the guardian wrote:
 * it never diagnoses, labels, scores or infers conditions (docs/12-privacy-by-design.md).
 */
export interface AIProvider {
  readonly name: string;
  structureCareNotes(request: StructureRequest): Promise<ProposedItem[]>;
}
