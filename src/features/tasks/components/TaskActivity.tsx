import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { Download, FileText, History, LoaderCircle, MessageSquare, Paperclip, Trash2, Upload } from "lucide-react";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { FormError } from "@/components/FeedbackBanner";
import { fieldErrorClass, inputClass, primaryButtonClass, smallButtonClass } from "@/components/ui";
import { getErrorMessage } from "@/lib/apiError";
import { fillTemplate, formatBytes, formatDateTime } from "@/lib/format";
import util from "@/lib/util.json";
import { Avatar } from "@/features/projects/components/Avatar";
import { useRemoteList } from "../hooks/useRemoteList";
import {
  addComment,
  deleteAttachment,
  downloadAttachment,
  listAttachments,
  listComments,
  listHistory,
  uploadAttachment,
} from "../services/taskService";
import { TASK_STATUSES, type TaskAttachment, type TaskComment, type TaskHistoryEntry } from "../types";

/** Resolve o nome de um integrante pelo id (o backend só envia ids de autor). */
export type NameOf = (userId: number | null | undefined) => string | null;

const t = util.tasks.details;

/** Limites do backend: comentário até 4000 caracteres e anexo até 5 MB. */
export const MAX_COMMENT_LENGTH = 4000;
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_EXTENSIONS = [
  "pdf", "png", "jpg", "jpeg", "gif", "webp", "svg", "txt", "md", "csv", "json",
  "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "zip",
];

export function validateAttachment(file: File): string {
  const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (!ALLOWED_ATTACHMENT_EXTENSIONS.includes(extension)) {
    return fillTemplate(t.attachments.invalidType, {
      types: ALLOWED_ATTACHMENT_EXTENSIONS.join(", "),
    });
  }
  if (file.size === 0) return t.attachments.emptyFile;
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return fillTemplate(t.attachments.tooLarge, { max: formatBytes(MAX_ATTACHMENT_BYTES) });
  }
  return "";
}

function Unavailable({ message }: { message: string }) {
  return <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">{message}</p>;
}

export function CommentsSection({
  taskId,
  canComment,
  nameOf,
}: {
  taskId: number;
  canComment: boolean;
  nameOf: NameOf;
}) {
  const loader = useCallback(() => listComments(taskId), [taskId]);
  const { state, reload, add } = useRemoteList<TaskComment>(loader, t.comments.loadError);
  const [draft, setDraft] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [serverError, setServerError] = useState("");
  const [sending, setSending] = useState(false);
  const textareaId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return setFieldError(t.comments.required);
    if (content.length > MAX_COMMENT_LENGTH) {
      return setFieldError(fillTemplate(t.comments.tooLong, { max: MAX_COMMENT_LENGTH }));
    }
    setFieldError("");
    setServerError("");
    setSending(true);
    try {
      const comment = await addComment(taskId, content);
      add(comment);
      setDraft("");
    } catch (error) {
      setServerError(getErrorMessage(error, t.comments.sendError));
    } finally {
      setSending(false);
    }
  };

  if (state.status === "unavailable") return <Unavailable message={t.comments.unavailable} />;

  return (
    <div className="flex flex-col gap-4">
      {state.status === "loading" && <LoadingState label={t.comments.loading} compact />}
      {state.status === "error" && (
        <ErrorState title={t.comments.loadError} message={state.message} onRetry={reload} compact />
      )}
      {state.status === "success" && state.items.length === 0 && (
        <EmptyState title={t.comments.empty} compact />
      )}
      {state.status === "success" && state.items.length > 0 && (
        <ul className="flex flex-col gap-3" aria-label={t.tabs.comments}>
          {state.items.map((comment) => {
            const authorName = comment.author?.username ?? nameOf(comment.author?.id);
            return (
            <li key={comment.id} className="flex gap-3">
              <Avatar name={authorName ?? "?"} className="size-7 text-[10px]" />
              <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                  <span className="font-semibold text-slate-800">
                    {authorName ?? t.unknownAuthor}
                  </span>
                  {comment.createdAt && (
                    <time className="text-slate-500" dateTime={String(comment.createdAt)}>
                      {formatDateTime(comment.createdAt)}
                    </time>
                  )}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                  {comment.content}
                </p>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      {canComment && state.status !== "loading" && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-2">
          <FormError message={serverError} />
          <label htmlFor={textareaId} className="sr-only">
            {t.comments.label}
          </label>
          <textarea
            id={textareaId}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              if (fieldError) setFieldError("");
            }}
            rows={3}
            placeholder={t.comments.placeholder}
            aria-invalid={Boolean(fieldError)}
            className={`${inputClass} resize-y py-3 text-sm`}
          />
          <div className="flex items-center justify-between gap-3">
            <span className={fieldError ? fieldErrorClass : "text-xs text-slate-500"}>
              {fieldError || `${draft.trim().length}/${MAX_COMMENT_LENGTH}`}
            </span>
            <button type="submit" disabled={sending} className={`${primaryButtonClass} h-9`}>
              {sending ? <LoaderCircle className="size-4 animate-spin" /> : <MessageSquare className="size-4" />}
              {sending ? t.comments.sending : t.comments.send}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function AttachmentsSection({
  taskId,
  canUpload,
  canDelete = false,
  nameOf,
}: {
  taskId: number;
  canUpload: boolean;
  /** Excluir anexos é do gerente do projeto. */
  canDelete?: boolean;
  nameOf: NameOf;
}) {
  const loader = useCallback(() => listAttachments(taskId), [taskId]);
  const { state, reload, add, update } = useRemoteList<TaskAttachment>(loader, t.attachments.loadError);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [serverError, setServerError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [downloadError, setDownloadError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  const pick = (selected: File | null) => {
    setServerError("");
    setFile(selected);
    setFileError(selected ? validateAttachment(selected) : "");
  };

  const upload = async () => {
    if (!file || fileError) return;
    setUploading(true);
    setServerError("");
    try {
      const attachment = await uploadAttachment(taskId, file);
      add(attachment, "start");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
    } catch (error) {
      setServerError(getErrorMessage(error, t.attachments.uploadError));
    } finally {
      setUploading(false);
    }
  };

  const download = async (attachment: TaskAttachment) => {
    setDownloadingId(attachment.id);
    setDownloadError("");
    try {
      const blob = await downloadAttachment(taskId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) {
      setDownloadError(getErrorMessage(error, t.attachments.downloadError));
    } finally {
      setDownloadingId(null);
    }
  };

  const remove = async (attachment: TaskAttachment) => {
    if (!window.confirm(fillTemplate(t.attachments.confirmDelete, { name: attachment.fileName }))) return;
    setDeletingId(attachment.id);
    setDownloadError("");
    try {
      await deleteAttachment(taskId, attachment.id);
      update((items) => items.filter((item) => item.id !== attachment.id));
    } catch (error) {
      setDownloadError(getErrorMessage(error, t.attachments.deleteError));
    } finally {
      setDeletingId(null);
    }
  };

  if (state.status === "unavailable") return <Unavailable message={t.attachments.unavailable} />;

  return (
    <div className="flex flex-col gap-4">
      {canUpload && state.status !== "loading" && (
        <div className="flex flex-col gap-2 rounded-xl border border-dashed border-slate-300 p-3">
          <FormError message={serverError} />
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor={inputId} className={`${smallButtonClass} cursor-pointer justify-center`}>
              <Paperclip className="size-4" /> {t.attachments.choose}
            </label>
            <input
              id={inputId}
              ref={inputRef}
              type="file"
              className="sr-only"
              accept={ALLOWED_ATTACHMENT_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
              onChange={(e) => pick(e.target.files?.[0] ?? null)}
              aria-invalid={Boolean(fileError)}
            />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-600">
              {file ? `${file.name} · ${formatBytes(file.size)}` : t.attachments.noFile}
            </span>
            <button
              type="button"
              onClick={upload}
              disabled={!file || Boolean(fileError) || uploading}
              className={`${primaryButtonClass} h-9`}
            >
              {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {uploading ? t.attachments.uploading : t.attachments.upload}
            </button>
          </div>
          <p className={fileError ? fieldErrorClass : "text-xs text-slate-500"} role={fileError ? "alert" : undefined}>
            {fileError ||
              fillTemplate(t.attachments.hint, { max: formatBytes(MAX_ATTACHMENT_BYTES) })}
          </p>
        </div>
      )}

      <FormError message={downloadError} />
      {state.status === "loading" && <LoadingState label={t.attachments.loading} compact />}
      {state.status === "error" && (
        <ErrorState title={t.attachments.loadError} message={state.message} onRetry={reload} compact />
      )}
      {state.status === "success" && state.items.length === 0 && (
        <EmptyState title={t.attachments.empty} compact />
      )}
      {state.status === "success" && state.items.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200" aria-label={t.tabs.attachments}>
          {state.items.map((attachment) => (
            <li key={attachment.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="size-5 shrink-0 text-slate-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{attachment.fileName}</p>
                <p className="text-xs text-slate-500">
                  {[
                    attachment.size != null ? formatBytes(attachment.size) : null,
                    attachment.uploadedBy?.username ?? nameOf(attachment.uploadedBy?.id),
                    attachment.createdAt ? formatDateTime(attachment.createdAt) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => download(attachment)}
                disabled={downloadingId === attachment.id}
                aria-label={fillTemplate(t.attachments.download, { name: attachment.fileName })}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-60"
              >
                {downloadingId === attachment.id ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={() => remove(attachment)}
                  disabled={deletingId === attachment.id}
                  aria-label={fillTemplate(t.attachments.delete, { name: attachment.fileName })}
                  className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
                >
                  {deletingId === attachment.id ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const statusLabel = (status: string | null) =>
  TASK_STATUSES.find((s) => s.value === status)?.label ?? status ?? "";

function describe(entry: TaskHistoryEntry, nameOf: NameOf): string {
  const h = t.history;
  switch (entry.action) {
    case "CRIACAO":
      return fillTemplate(h.created, { status: statusLabel(entry.status) });
    case "STATUS":
      return fillTemplate(h.status, { status: statusLabel(entry.status) });
    case "ATRIBUICAO":
      return entry.assigneeId != null
        ? fillTemplate(h.assigned, { name: nameOf(entry.assigneeId) ?? `#${entry.assigneeId}` })
        : h.unassigned;
    case "ATUALIZACAO":
      return h.updated;
    default:
      return fillTemplate(h.other, { action: entry.action.toLowerCase().replace(/_/g, " ") });
  }
}

export function HistorySection({ taskId, nameOf }: { taskId: number; nameOf: NameOf }) {
  const loader = useCallback(() => listHistory(taskId), [taskId]);
  const { state, reload } = useRemoteList<TaskHistoryEntry>(loader, t.history.loadError);

  if (state.status === "unavailable") return <Unavailable message={t.history.unavailable} />;
  if (state.status === "loading") return <LoadingState label={t.history.loading} compact />;
  if (state.status === "error") {
    return <ErrorState title={t.history.loadError} message={state.message} onRetry={reload} compact />;
  }
  if (state.items.length === 0) return <EmptyState title={t.history.empty} compact />;

  return (
    <ol className="relative ml-2 border-l border-slate-200" aria-label={t.tabs.history}>
      {state.items.map((entry) => {
        const actor = nameOf(entry.actorId);
        return (
          <li key={entry.id} className="mb-4 ml-4 last:mb-0">
            <span className="absolute -left-1.5 mt-1.5 size-3 rounded-full border-2 border-white bg-slate-300" aria-hidden="true" />
            <p className="text-sm text-slate-700">
              {actor && <span className="font-semibold text-slate-800">{actor} </span>}
              {describe(entry, nameOf)}
            </p>
            {entry.createdAt && (
              <time className="text-xs text-slate-500" dateTime={String(entry.createdAt)}>
                {formatDateTime(entry.createdAt)}
              </time>
            )}
          </li>
        );
      })}
    </ol>
  );
}

export const ACTIVITY_TABS = [
  { key: "comments", icon: MessageSquare },
  { key: "attachments", icon: Paperclip },
  { key: "history", icon: History },
] as const;
