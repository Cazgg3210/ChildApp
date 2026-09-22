import { randomUUID } from "node:crypto";
import { prisma } from "@/shared/db/prisma";
import { AppError } from "@/shared/errors/app-error";
import type { RequestMeta } from "@/shared/security/request-context";
import type { DocumentCategory } from "@/generated/prisma/enums";
import type { Actor } from "@/modules/identity/domain/types";
import { authorizationService } from "@/modules/authorization/application/authorization.service";
import { auditService } from "@/modules/audit/application/audit.service";
import { storage } from "../infrastructure/storage";
import { ALLOWED_DOCUMENT_TYPES, extensionFor, sniffMime } from "@/shared/security/mime";

const MAX_BYTES = 10 * 1024 * 1024;
const SIGNED_URL_TTL = 5 * 60;


export const documentService = {
  async upload(
    actor: Actor,
    childId: string,
    input: { title: string; category: DocumentCategory; file: File },
    meta?: RequestMeta,
  ) {
    await authorizationService.assert(actor, "document.upload", childId);
    if (actor.type !== "user") throw new AppError("ACCESS_DENIED");
    const title = input.title.trim();
    if (!title) throw new AppError("VALIDATION_ERROR", "Title is required.");
    if (input.file.size === 0 || input.file.size > MAX_BYTES)
      throw new AppError("VALIDATION_ERROR", "File must be between 1 byte and 10 MB.");
    if (!ALLOWED_DOCUMENT_TYPES.has(input.file.type)) throw new AppError("VALIDATION_ERROR", "Only PDF and images are allowed.");
    const ext = extensionFor(input.file.type);
    const key = `children/${childId}/documents/${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await input.file.arrayBuffer());
    const sniffed = sniffMime(bytes);
    if (!sniffed || sniffed !== input.file.type) throw new AppError("VALIDATION_ERROR", "The file content does not match its type.");
    await storage().put(key, bytes, input.file.type);
    const doc = await prisma.document.create({
      data: {
        childId,
        uploadedById: actor.userId,
        title,
        category: input.category,
        storageKey: key,
        mimeType: input.file.type,
        sizeBytes: input.file.size,
      },
    });
    await auditService.record({
      type: "DOCUMENT_UPLOADED",
      actor,
      childId,
      resourceType: "Document",
      resourceId: doc.id,
      dataCategories: ["DOCUMENTS"],
      context: { category: input.category },
      meta,
    });
    return doc;
  },

  async list(actor: Actor, childId: string) {
    await authorizationService.assert(actor, "document.read", childId, { category: "DOCUMENTS" });
    return prisma.document.findMany({
      where: { childId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { uploadedBy: { select: { name: true } } },
    });
  },

  /** Issues a short-lived signed URL after an authorization check; the access is audited. */
  async signedUrl(actor: Actor, documentId: string, meta?: RequestMeta) {
    const doc = await prisma.document.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw new AppError("NOT_FOUND", "Document not found");
    await authorizationService.assert(actor, "document.read", doc.childId, { category: "DOCUMENTS" });
    await auditService.record({
      type: "DOCUMENT_VIEWED",
      actor,
      childId: doc.childId,
      resourceType: "Document",
      resourceId: doc.id,
      dataCategories: ["DOCUMENTS"],
      meta,
    });
    return storage().getSignedUrl(doc.storageKey, SIGNED_URL_TTL);
  },

  async remove(actor: Actor, documentId: string, meta?: RequestMeta) {
    const doc = await prisma.document.findFirst({ where: { id: documentId, deletedAt: null } });
    if (!doc) throw new AppError("NOT_FOUND", "Document not found");
    await authorizationService.assert(actor, "document.upload", doc.childId);
    await prisma.document.update({ where: { id: documentId }, data: { deletedAt: new Date() } });
    await storage()
      .delete(doc.storageKey)
      .catch(() => undefined);
    await auditService.record({
      type: "DOCUMENT_DELETED",
      actor,
      childId: doc.childId,
      resourceType: "Document",
      resourceId: doc.id,
      meta,
    });
  },
};
