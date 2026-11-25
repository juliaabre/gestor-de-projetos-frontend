import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, LoaderCircle, RotateCcw, Send } from "lucide-react";
import { getAiErrorKind, getErrorMessage, isUnavailable } from "@/lib/apiError";
import { formatDateTime } from "@/lib/format";
import util from "@/lib/util.json";
import { inputClass, primaryButtonClass } from "@/components/ui";
import { askAssistant, getConversation } from "../services/aiService";
import type { AssistantAnswer } from "../types";
import { AiBadge, BottleneckAlert, SourceChips } from "./AiShared";

const t = util.ai.assistant;
export const MAX_QUESTION_LENGTH = 1000;

type Entry =
  | { id: string; question: string; status: "pending" }
  | { id: string; question: string; status: "failed"; message: string; unavailable: boolean }
  | ({ status: "answered" } & AssistantAnswer);

type HistoryState = "loading" | "loaded" | "unsupported" | "error";

export function AssistantPanel({
  projectId,
  onOpenTask,
}: {
  projectId: number;
  onOpenTask: (taskId: number) => void;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<HistoryState>("loading");
  const [question, setQuestion] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const inputId = useId();

  useEffect(() => {
    let active = true;
    getConversation(projectId)
      .then((items) => {
        if (!active) return;
        // Mescla: perguntas enviadas enquanto o histórico carregava não podem ser perdidas.
        setEntries((prev) => [...items.map((item) => ({ ...item, status: "answered" as const })), ...prev]);
        setHistory("loaded");
      })
      .catch((error) => active && setHistory(isUnavailable(error) ? "unsupported" : "error"));
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, [projectId]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [entries]);

  const send = async (text: string, replaceId?: string) => {
    // Trava síncrona: impede um segundo envio antes de o estado ser re-renderizado.
    if (pendingRef.current) return;
    const content = text.trim();
    if (!content) return setFieldError(t.required);
    if (content.length > MAX_QUESTION_LENGTH) return setFieldError(t.tooLong);
    setFieldError("");
    pendingRef.current = true;
    setPending(true);

    const id = replaceId ?? `local-${Date.now()}`;
    const pendingEntry: Entry = { id, question: content, status: "pending" };
    setEntries((prev) => (replaceId ? prev.map((e) => (e.id === replaceId ? pendingEntry : e)) : [...prev, pendingEntry]));
    if (!replaceId) setQuestion("");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const answer = await askAssistant(projectId, content, controller.signal);
      setEntries((prev) => prev.map((e) => (e.id === id ? { ...answer, question: content, status: "answered" } : e)));
    } catch (error) {
      if (controller.signal.aborted) return;
      const unavailable = getAiErrorKind(error) === "unavailable";
      setEntries((prev) =>
        prev.map((e) =>
          e.id === id
            ? {
                id,
                question: content,
                status: "failed",
                unavailable,
                message: unavailable ? t.unavailable : getErrorMessage(error, t.error),
              }
            : e,
        ),
      );
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void send(question);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void send(question);
    }
  };

  return (
    <section aria-labelledby="assistant-title" className="flex min-h-[28rem] flex-col rounded-2xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
        <h2 id="assistant-title" className="flex items-center gap-2 font-semibold text-slate-900">
          <Bot className="size-5 text-violet-600" aria-hidden="true" /> {t.title} <AiBadge />
        </h2>
        <p className="text-xs text-slate-500">
          {history === "unsupported" ? t.historyUnsupported : history === "error" ? t.historyError : t.historySaved}
        </p>
      </header>

      <ol
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-label={t.conversation}
        className="flex max-h-[32rem] flex-1 flex-col gap-4 overflow-y-auto px-5 py-4"
      >
        {history === "loading" && (
          <li className="flex items-center gap-2 text-sm text-slate-500">
            <LoaderCircle className="size-4 animate-spin" /> {t.historyLoading}
          </li>
        )}
        {history !== "loading" && entries.length === 0 && (
          <li className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            <p className="font-medium text-slate-700">{t.emptyTitle}</p>
            <p className="mt-1">{t.emptyDescription}</p>
          </li>
        )}
        {entries.map((entry) => (
          <li key={entry.id} className="flex flex-col gap-2">
            <p className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-sm bg-slate-100 px-3.5 py-2 text-sm text-slate-800">
              <span className="sr-only">{t.you}: </span>
              {entry.question}
            </p>

            {entry.status === "pending" && (
              <p className="flex items-center gap-2 text-sm text-slate-500">
                <LoaderCircle className="size-4 animate-spin" /> {t.thinking}
              </p>
            )}

            {entry.status === "failed" && (
              <div role="alert" className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm ${entry.unavailable ? "bg-slate-50 text-slate-600" : "bg-red-50 text-red-700"}`}>
                <p>{entry.message}</p>
                <button
                  type="button"
                  onClick={() => send(entry.question, entry.id)}
                  disabled={pending}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold underline disabled:opacity-50"
                >
                  <RotateCcw className="size-3" /> {util.common.retry}
                </button>
              </div>
            )}

            {entry.status === "answered" && (
              <div className="flex max-w-[92%] flex-col gap-2">
                <div className="rounded-2xl rounded-bl-sm bg-blue-50 px-3.5 py-2.5 text-sm text-blue-950">
                  <span className="sr-only">{t.assistant}: </span>
                  <p className="whitespace-pre-wrap break-words">{entry.answer}</p>
                  <div className="mt-2">
                    <SourceChips sources={entry.sources} onOpenTask={onOpenTask} />
                  </div>
                  {entry.createdAt && (
                    <p className="mt-1.5 text-[11px] text-blue-900/60">{formatDateTime(entry.createdAt)}</p>
                  )}
                </div>
                {entry.bottlenecks.map((bottleneck, index) => (
                  <BottleneckAlert key={index} bottleneck={bottleneck} onOpenTask={onOpenTask} />
                ))}
              </div>
            )}
          </li>
        ))}
      </ol>

      <form onSubmit={onSubmit} noValidate className="border-t border-slate-100 px-5 py-4">
        <label htmlFor={inputId} className="sr-only">
          {t.label}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <textarea
            id={inputId}
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value);
              if (fieldError) setFieldError("");
            }}
            onKeyDown={onKeyDown}
            rows={1}
            maxLength={MAX_QUESTION_LENGTH}
            placeholder={t.placeholder}
            aria-invalid={Boolean(fieldError)}
            className={`${inputClass} min-h-11 resize-y py-2.5 text-sm`}
          />
          <button type="submit" disabled={pending} className={`${primaryButtonClass} shrink-0`}>
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            {pending ? t.sending : t.send}
          </button>
        </div>
        <p className={`mt-1.5 text-xs ${fieldError ? "text-red-600" : "text-slate-400"}`}>
          {fieldError || t.disclaimer}
        </p>
      </form>
    </section>
  );
}
