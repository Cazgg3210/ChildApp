import { prisma, type Tx } from "@/shared/db/prisma";
import { Prisma, type ProfileItem } from "@/generated/prisma/client";
import type { Criticality, ProfileSection, ProvenanceStatus, SourceType } from "@/generated/prisma/enums";

export interface NewProfileItem {
  section: ProfileSection;
  itemType: string;
  label: string;
  details?: string | null;
  data?: Record<string, unknown> | null;
  criticality: Criticality;
  provenance?: ProvenanceStatus;
  sourceType?: SourceType;
  sourceLabel?: string | null;
  sourceInstitutionId?: string | null;
  documentId?: string | null;
  createdById?: string | null;
}

const itemOrder = [{ criticality: "asc" as const }, { sortOrder: "asc" as const }, { createdAt: "asc" as const }];

export const profileRepository = {
  listActive(childId: string, tx?: Tx): Promise<ProfileItem[]> {
    return (tx ?? prisma).profileItem.findMany({ where: { childId, deletedAt: null }, orderBy: itemOrder });
  },

  listActiveForChildren(childIds: string[]): Promise<ProfileItem[]> {
    return prisma.profileItem.findMany({ where: { childId: { in: childIds }, deletedAt: null }, orderBy: itemOrder });
  },

  findActive(childId: string, itemId: string, tx?: Tx) {
    return (tx ?? prisma).profileItem.findFirst({ where: { id: itemId, childId, deletedAt: null } });
  },

  create(childId: string, item: NewProfileItem, tx?: Tx) {
    return (tx ?? prisma).profileItem.create({
      data: {
        childId,
        section: item.section,
        itemType: item.itemType,
        label: item.label,
        details: item.details ?? null,
        data: (item.data ?? undefined) as Prisma.InputJsonValue | undefined,
        criticality: item.criticality,
        provenance: item.provenance ?? "SELF_DECLARED",
        sourceType: item.sourceType ?? "GUARDIAN",
        sourceLabel: item.sourceLabel ?? null,
        sourceInstitutionId: item.sourceInstitutionId ?? null,
        documentId: item.documentId ?? null,
        createdById: item.createdById ?? null,
      },
    });
  },

  update(itemId: string, item: Partial<NewProfileItem>, tx?: Tx) {
    return (tx ?? prisma).profileItem.update({
      where: { id: itemId },
      data: {
        ...(item.itemType !== undefined ? { itemType: item.itemType } : {}),
        ...(item.label !== undefined ? { label: item.label } : {}),
        ...(item.details !== undefined ? { details: item.details } : {}),
        ...(item.data !== undefined
          ? { data: item.data === null ? Prisma.DbNull : (item.data as Prisma.InputJsonValue) }
          : {}),
        ...(item.criticality !== undefined ? { criticality: item.criticality } : {}),
        ...(item.provenance !== undefined ? { provenance: item.provenance } : {}),
        ...(item.sourceType !== undefined ? { sourceType: item.sourceType } : {}),
        ...(item.sourceLabel !== undefined ? { sourceLabel: item.sourceLabel } : {}),
      },
    });
  },

  /** Bumps updatedAt without changing content (re-confirmation). */
  touch(itemId: string, tx?: Tx) {
    return (tx ?? prisma).profileItem.update({ where: { id: itemId }, data: { updatedAt: new Date() } });
  },

  softDelete(itemId: string, tx?: Tx) {
    return (tx ?? prisma).profileItem.update({ where: { id: itemId }, data: { deletedAt: new Date() } });
  },

  createVersion(
    data: {
      childId: string;
      version: number;
      snapshot: unknown;
      changes: unknown;
      summary: string;
      createdById?: string | null;
    },
    tx?: Tx,
  ) {
    return (tx ?? prisma).childProfileVersion.create({
      data: {
        childId: data.childId,
        version: data.version,
        snapshot: data.snapshot as Prisma.InputJsonValue,
        changes: data.changes as Prisma.InputJsonValue,
        summary: data.summary,
        createdById: data.createdById ?? null,
      },
    });
  },

  listVersionsAfter(childId: string, afterVersion: number) {
    return prisma.childProfileVersion.findMany({
      where: { childId, version: { gt: afterVersion } },
      orderBy: { version: "asc" },
    });
  },

  listVersions(childId: string, limit = 20) {
    return prisma.childProfileVersion.findMany({
      where: { childId },
      orderBy: { version: "desc" },
      take: limit,
      include: { createdBy: { select: { name: true } } },
    });
  },
};
