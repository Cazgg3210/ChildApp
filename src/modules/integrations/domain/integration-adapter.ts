import type { DataCategory } from "@/shared/domain/care-vocabulary";

/**
 * Interoperability contract (docs/15-roadmap.md, V2). External childcare and
 * school systems plug in through adapters; nothing in the MVP calls them yet.
 *
 * Design rules that adapters must respect:
 *  - Export only categories present in an ACTIVE AccessGrant for the target.
 *  - Never push writes into the profile: imports become ChangeProposals.
 *  - Every export/import is recorded through AuditService.
 */
export interface CareProfileExport {
  childId: string;
  profileVersion: number;
  exportedAt: string;
  categories: DataCategory[];
  items: {
    section: string;
    itemType: string;
    label: string;
    details: string | null;
    data: unknown;
    criticality: string;
    provenance: string;
  }[];
}

export interface ImportedObservation {
  externalId: string;
  section: "PLAY" | "SOCIAL" | "COMMUNICATION" | "COMFORT" | "NUTRITION" | "SLEEP";
  label: string;
  details?: string;
  observedAt: string;
}

export interface IntegrationAdapter {
  readonly provider: "famly" | "brightwheel" | "storypark" | "procare" | "custom";
  /** Push the authorized subset of a child's profile to the external system. */
  exportChildCareProfile(
    profile: CareProfileExport,
    target: { externalChildId: string },
  ): Promise<{ ok: boolean; externalRef?: string }>;
  /** Pull observations made in the external system; the caller turns them into ChangeProposals. */
  importObservations(target: { externalChildId: string; since?: string }): Promise<ImportedObservation[]>;
}

class NotImplementedAdapter implements IntegrationAdapter {
  constructor(readonly provider: IntegrationAdapter["provider"]) {}
  async exportChildCareProfile(): Promise<{ ok: boolean }> {
    throw new Error(`${this.provider} adapter is not implemented in the MVP`);
  }
  async importObservations(): Promise<ImportedObservation[]> {
    throw new Error(`${this.provider} adapter is not implemented in the MVP`);
  }
}

export const FamlyAdapter = new NotImplementedAdapter("famly");
export const BrightwheelAdapter = new NotImplementedAdapter("brightwheel");
export const StoryparkAdapter = new NotImplementedAdapter("storypark");
export const ProcareAdapter = new NotImplementedAdapter("procare");
