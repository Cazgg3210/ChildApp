import { getLocale, getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/feature/page-header";
import { documentService } from "@/modules/documents/application/document.service";
import { formatDate } from "@/shared/utils/dates";
import { loadGuardianChild } from "../_lib/load-child";
import { DocumentActions, UploadDocumentDialog } from "./document-actions";

export default async function DocumentsPage({ params }: PageProps<"/app/children/[id]/documents">) {
  const { id } = await params;
  const { actor } = await loadGuardianChild(id);
  const [t, locale, docs] = await Promise.all([
    getTranslations("documents"),
    getLocale(),
    documentService.list(actor, id),
  ]);
  return (
    <div>
      <PageHeader title={t("title")} description={t("subtitle")} actions={<UploadDocumentDialog childId={id} />} />
      {docs.length === 0 ? (
        <EmptyState icon={FileText} title={t("empty")} action={<UploadDocumentDialog childId={id} />} />
      ) : (
        <ul className="divide-y rounded-2xl border bg-card">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                  <FileText className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {t(`categories.${d.category}`)} · {(d.sizeBytes / 1024).toFixed(0)} KB · {d.uploadedBy.name} ·{" "}
                    {formatDate(d.createdAt, locale, "PP")}
                  </p>
                </div>
              </div>
              <DocumentActions childId={id} documentId={d.id} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
