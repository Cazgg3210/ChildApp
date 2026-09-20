import type { Capability, DataCategory } from "@/shared/domain/care-vocabulary";
import type { DenialReason, GrantView } from "./policy";

/** Actions on a child resource. Guardian-only actions require a ChildGuardian row. */
export type ChildAction =
  | "child.read"
  | "child.update"
  | "child.delete"
  | "child.manage_guardians"
  | "profile.read"
  | "profile.update"
  | "share.create"
  | "share.revoke"
  | "audit.read"
  | "proposal.review"
  | "proposal.create"
  | "document.upload"
  | "document.read"
  | "acknowledge"
  | "care_session.run"
  | "care_session.read";

export type InstitutionAction = "institution.read" | "institution.manage";

export type GuardianAccessRole = "OWNER" | "CO_GUARDIAN";

export interface GrantAccessView extends GrantView {
  recipientKind: "FAMILY" | "BABYSITTER" | "INSTITUTION" | "OTHER";
  recipientName: string;
  subjectInstitutionId: string | null;
  grantedById: string;
}

/** How an actor reaches a child, and what that path allows. */
export type ChildAccess =
  | { via: "guardian"; role: GuardianAccessRole; categories: DataCategory[]; capabilities: Capability[] }
  | { via: "grant"; grant: GrantAccessView; categories: DataCategory[]; capabilities: Capability[] }
  | {
      via: "institution";
      institutionId: string;
      institutionRole: "ADMIN" | "MEMBER";
      grant: GrantAccessView;
      categories: DataCategory[];
      capabilities: Capability[];
    };

export type Decision = { allowed: true; access: ChildAccess } | { allowed: false; reason: DenialReason };

export const GUARDIAN_ONLY_ACTIONS: ChildAction[] = [
  "child.update",
  "child.delete",
  "child.manage_guardians",
  "profile.update",
  "share.create",
  "share.revoke",
  "audit.read",
  "proposal.review",
  "document.upload",
  "care_session.read",
];

export const OWNER_ONLY_ACTIONS: ChildAction[] = ["child.delete", "child.manage_guardians"];

/** Actions that map to a grant capability when the actor is not a guardian. */
export const CAPABILITY_FOR_ACTION: Partial<Record<ChildAction, Capability>> = {
  acknowledge: "ACKNOWLEDGE",
  "care_session.run": "RUN_CARE_SESSION",
  "proposal.create": "PROPOSE_CHANGES",
  "document.read": "VIEW_DOCUMENTS",
};
