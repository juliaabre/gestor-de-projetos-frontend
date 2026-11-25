import { useState } from "react";
import { LoaderCircle, Sparkles, X } from "lucide-react";
import { FormError } from "@/components/FeedbackBanner";
import { smallButtonClass } from "@/components/ui";
import { getErrorMessage } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import { dependentsOf } from "@/features/tasks/board";
import type { Task } from "@/features/tasks/types";
import { suggestDependencies } from "../services/aiService";
import { aiFailure, type AiState } from "../state";
import type { AiAnswer, DependencySuggestion } from "../types";
import { AiBadge, AiNotice, AiText, AiUnavailable } from "./AiShared";

const t = util.ai.dependencies;

/**
 * Lista dependências sugeridas pela IA como sugestões (borda tracejada), separadas
 * das dependências confirmadas. Só são registradas após seleção e confirmação.
 */
export function DependencySuggestions({
  task,
  tasks,
  onRegister,
}: {
  task: Task;
  tasks: Task[];
  onRegister: (dependencyIds: number[]) => Promise<void>;
}) {
  const [state, setState] = useState<AiState<{ answer: AiAnswer; items: DependencySuggestion[] }>>({
    status: "idle",
  });
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    setState({ status: "loading" });
    setSelected(new Set());
    setError("");
    try {
      const { answer, suggestions } = await suggestDependencies(task.id);
      // Descarta sugestões inválidas: a própria tarefa, já confirmadas, inexistentes ou que criariam ciclo.
      const blocked = dependentsOf(task.id, tasks);
      const valid = suggestions.filter(
        (s) =>
          s.taskId !== task.id &&
          !task.dependencyIds.includes(s.taskId) &&
          !blocked.has(s.taskId) &&
          tasks.some((candidate) => candidate.id === s.taskId),
      );
      setState({ status: "success", data: { answer, items: valid } });
    } catch (err) {
      setState(aiFailure(err, t.error));
    }
  };

  const register = async () => {
    setSaving(true);
    setError("");
    try {
      await onRegister([...task.dependencyIds, ...selected]);
      setState({ status: "idle" });
      setSelected(new Set());
    } catch (err) {
      setError(getErrorMessage(err, t.registerError));
    } finally {
      setSaving(false);
    }
  };

  const titleOf = (suggestion: DependencySuggestion) =>
    tasks.find((candidate) => candidate.id === suggestion.taskId)?.title ?? suggestion.title ?? `#${suggestion.taskId}`;

  if (state.status === "idle") {
    return (
      <button type="button" onClick={load} className={`${smallButtonClass} w-fit border-violet-200 text-violet-800 hover:bg-violet-50`}>
        <Sparkles className="size-4" /> {t.suggest}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-xs font-medium text-slate-600">
          <AiBadge label={t.badge} /> {t.hint}
        </p>
        {state.status !== "loading" && (
          <button
            type="button"
            onClick={() => setState({ status: "idle" })}
            aria-label={t.discard}
            className="rounded-lg p-1 text-slate-500 hover:bg-white hover:text-slate-700"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {state.status === "loading" && (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <LoaderCircle className="size-4 animate-spin" /> {t.loading}
        </p>
      )}
      {state.status === "unavailable" && <AiUnavailable message={t.unavailable} />}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}{" "}
          <button type="button" onClick={load} className="font-semibold underline">
            {util.common.retry}
          </button>
        </p>
      )}
      {state.status === "success" && (
        <details className="rounded-lg bg-white px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-slate-600">{t.answer}</summary>
          <div className="mt-2 flex flex-col gap-2">
            <AiNotice answer={state.data.answer} />
            <AiText text={state.data.answer.text} />
          </div>
        </details>
      )}
      {state.status === "success" && state.data.items.length === 0 && (
        <p className="text-sm text-slate-600">{t.empty}</p>
      )}
      {state.status === "success" && state.data.items.length > 0 && (
        <>
          <FormError message={error} />
          <ul className="flex flex-col gap-1.5" aria-label={t.listLabel}>
            {state.data.items.map((suggestion) => {
              const checked = selected.has(suggestion.taskId);
              return (
                <li key={suggestion.taskId}>
                  <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-dashed border-violet-300 bg-white px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (next.has(suggestion.taskId)) next.delete(suggestion.taskId);
                          else next.add(suggestion.taskId);
                          return next;
                        })
                      }
                      className="mt-0.5 size-4 accent-violet-600"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-slate-800">
                        {titleOf(suggestion)}
                        {suggestion.confidence != null && (
                          <span className="ml-2 text-xs font-normal text-slate-500">
                            {fillTemplate(t.confidence, { value: suggestion.confidence })}
                          </span>
                        )}
                      </span>
                      {suggestion.justification && (
                        <span className="mt-0.5 line-clamp-2 block text-xs text-slate-600">{suggestion.justification}</span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setState({ status: "idle" })} disabled={saving} className={smallButtonClass}>
              {t.discard}
            </button>
            <button
              type="button"
              onClick={register}
              disabled={selected.size === 0 || saving}
              className={`${smallButtonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`}
            >
              {saving && <LoaderCircle className="size-4 animate-spin" />}
              {fillTemplate(t.register, { count: selected.size })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
