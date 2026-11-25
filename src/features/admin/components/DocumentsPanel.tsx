import { useCallback, useEffect, useId, useRef, useState } from "react";
import { FileText, LoaderCircle, Trash2, Upload } from "lucide-react";
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
import { deleteDocument, listChunks, listDocuments, uploadDocument } from "../services/knowledgeService";
import type { DocumentChunk, KnowledgeDocument } from "../types";

const t = util.admin.documents;
/** Limites do backend: PDF com texto, Markdown ou texto UTF-8, até 5 MB. */
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const DOCUMENT_EXTENSIONS = ["pdf", "md", "markdown", "txt"];

export function validateDocument(file: File): string {
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!DOCUMENT_EXTENSIONS.includes(extension)) return t.invalidType;
  if (file.size === 0) return t.emptyFile;
  if (file.size > MAX_DOCUMENT_BYTES) return fillTemplate(t.tooLarge, { max: formatBytes(MAX_DOCUMENT_BYTES) });
  return "";
}

/**
 * Documentos são indexados por projeto. O backend só aceita a indexação por
 * um administrador que integra a equipe de um projeto ativo, por isso a lista
 * mostra os projetos ativos dos quais o administrador participa.
 */
export function DocumentsPanel() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [projectsError, setProjectsError] = useState("");
  const [projectId, setProjectId] = useState<number | null>(null);

  const loadProjects = useCallback(() => {
    setProjects(null);
    setProjectsError("");
    listProjects()
      .then((list) => {
        const active = list.filter((project) => !project.archived);
        setProjects(active);
        setProjectId((current) => current ?? active[0]?.id ?? null);
      })
      .catch((error) => setProjectsError(getErrorMessage(error, t.projectsError)));
  }, []);
  useEffect(loadProjects, [loadProjects]);

  if (projectsError) return <ErrorState title={t.projectsError} message={projectsError} onRetry={loadProjects} />;
  if (!projects) return <LoadingState label={t.projectsLoading} />;
  if (projects.length === 0 || projectId == null) {
    return <EmptyState title={t.noProjectsTitle} description={t.noProjects} />;
  }

  return (
    <div className="flex flex-col gap-5">
      <label className={`${labelClass} max-w-md`}>
        {t.project}
        <select
          value={projectId}
          onChange={(e) => setProjectId(Number(e.target.value))}
          className={`${inputClass} h-11 text-sm`}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <span className="text-xs font-normal text-slate-500">{t.projectHint}</span>
      </label>
      <ProjectDocuments key={projectId} projectId={projectId} />
    </div>
  );
}

function ProjectDocuments({ projectId }: { projectId: number }) {
  const loader = useCallback(() => listDocuments(projectId), [projectId]);
  const { state, reload, add, update } = useRemoteList<KnowledgeDocument>(loader, t.loadError);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [toDelete, setToDelete] = useState<KnowledgeDocument | null>(null);
  const { feedback, success, clear } = useFeedback();
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

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
      const doc = await uploadDocument(projectId, file);
      add(doc, "start");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      success(fillTemplate(t.uploaded, { name: doc.fileName, count: doc.chunks }));
    } catch (error) {
      setUploadError(getErrorMessage(error, t.uploadError));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <FeedbackBanner feedback={feedback} onClose={clear} />

      <section aria-labelledby="upload-title" className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 id="upload-title" className="font-semibold text-slate-900">{t.uploadTitle}</h2>
        <p className="mt-1 text-sm text-slate-500">{t.uploadDescription}</p>
        <div className="mt-4 flex flex-col gap-4">
          <FormError message={uploadError} />
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
          <button type="button" onClick={upload} disabled={uploading} className={`${primaryButtonClass} w-full sm:w-fit sm:self-end`}>
            {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
            {uploading ? t.uploading : t.upload}
          </button>
        </div>
      </section>

      <section aria-labelledby="documents-title">
        <h2 id="documents-title" className="mb-3 font-semibold text-slate-900">{t.listTitle}</h2>
        {state.status === "loading" && <LoadingState label={t.loading} />}
        {state.status === "unavailable" && <EmptyState title={t.unavailableTitle} description={t.unavailable} />}
        {state.status === "error" && <ErrorState title={t.loadError} message={state.message} onRetry={reload} />}
        {state.status === "success" && state.items.length === 0 && (
          <EmptyState title={t.emptyTitle} description={t.emptyDescription} />
        )}
        {state.status === "success" && state.items.length > 0 && (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white" aria-label={t.listTitle}>
            {state.items.map((doc) => (
              <li key={doc.id} className="flex flex-col gap-2 px-4 py-3">
                <div className="flex items-center gap-3">
                  <FileText className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{doc.fileName}</p>
                    <p className="text-xs text-slate-500">
                      {[
                        doc.type,
                        fillTemplate(t.chunks, { count: doc.chunks }),
                        doc.createdAt ? formatDateTime(doc.createdAt) : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setToDelete(doc)}
                    aria-label={fillTemplate(t.delete, { name: doc.fileName })}
                    className={`${smallButtonClass} w-fit border-transparent text-slate-500 hover:text-red-700`}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <ChunksPreview projectId={projectId} document={doc} />
              </li>
            ))}
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
            await deleteDocument(projectId, toDelete.id);
            update((items) => items.filter((item) => item.id !== toDelete.id));
            setToDelete(null);
            success(fillTemplate(t.deleted, { name: toDelete.fileName }));
          }}
        />
      )}
    </div>
  );
}

/** Mostra, sob demanda, os trechos que a IA recupera do documento. */
function ChunksPreview({ projectId, document }: { projectId: number; document: KnowledgeDocument }) {
  const [state, setState] = useState<
    { status: "idle" | "loading" } | { status: "error"; message: string } | { status: "success"; items: DocumentChunk[] }
  >({ status: "idle" });

  const load = () => {
    setState({ status: "loading" });
    listChunks(projectId, document.id)
      .then((items) => setState({ status: "success", items }))
      .catch((error) => setState({ status: "error", message: getErrorMessage(error, t.chunksError) }));
  };

  return (
    <details
      className="pl-8 text-xs"
      onToggle={(event) => {
        if ((event.currentTarget as HTMLDetailsElement).open && state.status === "idle") load();
      }}
    >
      <summary className="cursor-pointer font-medium text-slate-600 hover:text-slate-900">{t.viewChunks}</summary>
      <div className="mt-2">
        {state.status === "loading" && <LoadingState label={t.chunksLoading} compact />}
        {state.status === "error" && <ErrorState title={t.chunksError} message={state.message} onRetry={load} compact />}
        {state.status === "success" && (
          <ol className="flex max-h-64 flex-col gap-2 overflow-y-auto">
            {state.items.map((chunk) => (
              <li key={chunk.ref} className="rounded-lg bg-slate-50 px-3 py-2 text-slate-700">
                <span className="font-semibold text-slate-500">
                  {chunk.page != null ? fillTemplate(t.chunkPage, { ref: chunk.ref, page: chunk.page }) : chunk.ref}
                </span>{" "}
                {chunk.excerpt}
              </li>
            ))}
          </ol>
        )}
      </div>
    </details>
  );
}
