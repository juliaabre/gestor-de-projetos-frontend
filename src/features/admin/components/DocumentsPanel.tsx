import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Clock, FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackBanner, FormError, useFeedback } from "@/components/FeedbackBanner";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { fieldErrorClass, inputClass, labelClass, primaryButtonClass, smallButtonClass } from "@/components/ui";
import { getErrorMessage } from "@/lib/apiError";
import { fillTemplate, formatBytes, formatDateTime } from "@/lib/format";
import util from "@/lib/util.json";
import { listProjects } from "@/features/projects/services/projectService";
import type { Project } from "@/features/projects/types";
import { useRemoteList } from "@/features/tasks/hooks/useRemoteList";
import { deleteDocument, listDocuments, uploadDocument } from "../services/knowledgeService";
import type { DocumentStatus, KnowledgeDocument } from "../types";

const t = util.admin.documents;
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS = ["pdf", "md", "markdown", "txt"];
export const POLL_INTERVAL = 4000;

export function validateDocument(file: File): string {
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!DOCUMENT_EXTENSIONS.includes(extension)) return t.invalidType;
  if (file.size === 0) return t.emptyFile;
  if (file.size > MAX_DOCUMENT_BYTES) return fillTemplate(t.tooLarge, { max: formatBytes(MAX_DOCUMENT_BYTES) });
  return "";
}

const STATUS_UI: Record<DocumentStatus, { label: string; className: string; icon: typeof Clock }> = {
  PENDING: { label: t.status.pending, className: "bg-slate-100 text-slate-700", icon: Clock },
  PROCESSING: { label: t.status.processing, className: "bg-blue-50 text-blue-700", icon: LoaderCircle },
  INDEXED: { label: t.status.indexed, className: "bg-emerald-50 text-emerald-700", icon: CheckCircle2 },
  FAILED: { label: t.status.failed, className: "bg-red-50 text-red-700", icon: AlertCircle },
};

const inProgress = (doc: KnowledgeDocument) => doc.status === "PENDING" || doc.status === "PROCESSING";

export function DocumentsPanel() {
  const { state, reload, add, update, refresh } = useRemoteList<KnowledgeDocument>(listDocuments, t.loadError);
  const [projects, setProjects] = useState<Project[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [projectId, setProjectId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [toDelete, setToDelete] = useState<KnowledgeDocument | null>(null);
  const { feedback, success, clear } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  useEffect(() => {
    listProjects().then(setProjects).catch(() => setProjects([]));
  }, []);

  // Acompanha o processamento enquanto houver documentos pendentes.
  const hasPending = state.status === "success" && state.items.some(inProgress);
  useEffect(() => {
    if (!hasPending) return;
    const id = setInterval(() => void refresh(), POLL_INTERVAL);
    return () => clearInterval(id);
  }, [hasPending, refresh]);

  const pick = (selected: File | null) => {
    setUploadError("");
    setFile(selected);
    setFileError(selected ? validateDocument(selected) : "");
  };

  const upload = async () => {
    if (!file) return setFileError(t.fileRequired);
    if (fileError) return;
    setUploading(true);
    setUploadError("");
    try {
      const doc = await uploadDocument(file, projectId ? Number(projectId) : null);
      add(doc, "start");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      success(fillTemplate(t.uploaded, { name: doc.fileName }));
    } catch (error) {
      setUploadError(getErrorMessage(error, t.uploadError));
    } finally {
      setUploading(false);
    }
  };

  const projectName = (id: number | null) =>
    id == null ? t.global : (projects.find((p) => p.id === id)?.name ?? fillTemplate(t.projectFallback, { id }));

  if (state.status === "unavailable") {
    return <EmptyState title={t.unavailableTitle} description={t.unavailable} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBanner feedback={feedback} onClose={clear} />

      <section aria-labelledby="upload-title" className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 id="upload-title" className="font-semibold text-slate-900">{t.uploadTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.uploadDescription}</p>
        <div className="mt-4 flex flex-col gap-4">
          <FormError message={uploadError} />
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]">
            <div className="flex flex-col gap-2 text-sm font-medium text-slate-700">
              <label htmlFor={inputId}>{t.file}</label>
              <input
                id={inputId}
                ref={inputRef}
                type="file"
                accept={DOCUMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
                onChange={(e) => pick(e.target.files?.[0] ?? null)}
                aria-invalid={Boolean(fileError)}
                className="block w-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 file:ring-1 file:ring-slate-200"
              />
              <span className={fileError ? fieldErrorClass : "text-xs font-normal text-slate-500"} role={fileError ? "alert" : undefined}>
                {fileError || fillTemplate(t.hint, { max: formatBytes(MAX_DOCUMENT_BYTES) })}
              </span>
            </div>
            <label className={labelClass}>
              {t.scope}
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={`${inputClass} h-11 text-sm`}>
                <option value="">{t.global}</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
              <span className="text-xs font-normal text-slate-500">{t.scopeHint}</span>
            </label>
          </div>
          <button type="button" onClick={upload} disabled={uploading} className={`${primaryButtonClass} w-full sm:w-fit sm:self-end`}>
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? t.uploading : t.upload}
          </button>
        </div>
      </section>

      <section aria-labelledby="documents-title">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 id="documents-title" className="font-semibold text-slate-900">{t.listTitle}</h2>
          {hasPending && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <LoaderCircle className="size-3.5 animate-spin" /> {t.polling}
            </span>
          )}
        </div>
        {state.status === "loading" && <LoadingState label={t.loading} />}
        {state.status === "error" && <ErrorState title={t.loadError} message={state.message} onRetry={reload} />}
        {state.status === "success" && state.items.length === 0 && (
          <EmptyState title={t.emptyTitle} description={t.emptyDescription} />
        )}
        {state.status === "success" && state.items.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white" aria-label={t.listTitle}>
            {state.items.map((doc) => {
              const status = STATUS_UI[doc.status];
              const StatusIcon = status.icon;
              return (
                <li key={doc.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <FileText className="hidden size-5 shrink-0 text-slate-500 sm:block" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {[
                        projectName(doc.projectId),
                        doc.size != null ? formatBytes(doc.size) : null,
                        doc.createdAt ? formatDateTime(doc.createdAt) : null,
                        doc.status === "INDEXED" && doc.chunks != null ? fillTemplate(t.chunks, { count: doc.chunks }) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {doc.status === "FAILED" && doc.errorMessage && (
                      <p className="mt-1 text-xs text-red-700">{doc.errorMessage}</p>
                    )}
                  </div>
                  <span className={`inline-flex w-fit items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}>
                    <StatusIcon className={`size-3.5 ${doc.status === "PROCESSING" ? "animate-spin" : ""}`} aria-hidden="true" />
                    {status.label}
                  </span>
                  <button
                    type="button"
                    onClick={() => setToDelete(doc)}
                    aria-label={fillTemplate(t.delete, { name: doc.fileName })}
                    className={`${smallButtonClass} w-fit border-transparent text-slate-500 hover:text-red-700`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {toDelete && (
        <ConfirmDialog
          title={t.deleteDialog.title}
          description={fillTemplate(t.deleteDialog.description, { name: toDelete.fileName })}
          confirmLabel={t.deleteDialog.confirm}
          confirmingLabel={t.deleteDialog.confirming}
          getError={(error) => getErrorMessage(error, t.deleteDialog.error)}
          onClose={() => setToDelete(null)}
          onConfirm={async () => {
            await deleteDocument(toDelete.id);
            update((items) => items.filter((item) => item.id !== toDelete.id));
            setToDelete(null);
            success(fillTemplate(t.deleted, { name: toDelete.fileName }));
          }}
        />
      )}
    </div>
  );
}
