import { useId, useState } from "react";
import { Check, LoaderCircle, Pencil, Sparkles, X } from "lucide-react";
import { inputClass, smallButtonClass } from "@/components/ui";
import util from "@/lib/util.json";
import { generateDescription } from "../services/aiService";
import { aiFailure, type AiState } from "../state";
import type { AiAnswer } from "../types";
import { AiBadge, AiNotice, AiUnavailable, SourceChips } from "./AiShared";

const t = util.ai.description;

/** Monta a instrução enviada como `pergunta` (até 4000 caracteres no backend). */
export function buildDescriptionPrompt(input: {
  title: string;
  current: string;
  instruction: string;
  requirements?: string;
}): string {
  const parts = [
    input.current
      ? `Refine a descrição da tarefa "${input.title}".`
      : `Gere uma descrição para a tarefa "${input.title}".`,
  ];
  if (input.current) parts.push(`Descrição atual: ${input.current.slice(0, 2500)}`);
  if (input.requirements) parts.push(`Requisitos: ${input.requirements.slice(0, 800)}`);
  if (input.instruction) parts.push(`Instrução: ${input.instruction}`);
  return parts.join("\n").slice(0, 4000);
}

/**
 * Gera ou refina a descrição de uma tarefa. A sugestão fica numa área de
 * revisão e só vai para o formulário quando o usuário aceita.
 */
export function DescriptionAssistant({
  taskId,
  getTitle,
  getCurrent,
  getRequirements,
  onAccept,
}: {
  /** O backend gera descrições só para tarefas já salvas. */
  taskId?: number;
  getTitle: () => string;
  getCurrent: () => string;
  getRequirements?: () => string;
  onAccept: (description: string) => void;
}) {
  const [state, setState] = useState<AiState<AiAnswer>>({ status: "idle" });
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [hint, setHint] = useState("");
  const draftId = useId();
  const refine = getCurrent().trim().length > 0;

  const generate = async () => {
    const title = getTitle().trim();
    if (!title) return setHint(t.titleRequired);
    setHint("");
    setEditing(false);
    setState({ status: "loading" });
    try {
      const data = await generateDescription(
        taskId!,
        buildDescriptionPrompt({
          title,
          current: getCurrent().trim(),
          instruction: instruction.trim(),
          requirements: getRequirements?.().trim(),
        }),
      );
      setDraft(data.text);
      setState({ status: "success", data });
    } catch (error) {
      setState(aiFailure(error, t.error));
    }
  };

  const discard = () => {
    setState({ status: "idle" });
    setDraft("");
    setEditing(false);
  };

  const loading = state.status === "loading";

  if (taskId == null) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/40 px-3 py-2 text-xs text-slate-600">
        <Sparkles className="size-4 shrink-0 text-violet-600" aria-hidden="true" /> {t.saveFirst}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-violet-200 bg-violet-50/40 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          maxLength={300}
          placeholder={t.instructionPlaceholder}
          aria-label={t.instruction}
          className={`${inputClass} h-9 flex-1 text-sm`}
        />
        <button type="button" onClick={generate} disabled={loading} className={`${smallButtonClass} justify-center border-violet-200 text-violet-800 hover:bg-violet-100`}>
          {loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {loading ? t.generating : refine ? t.refine : t.generate}
        </button>
      </div>
      {hint && <p className="text-xs text-red-600">{hint}</p>}

      {state.status === "unavailable" && <AiUnavailable message={t.unavailable} />}
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-700">
          {state.message}
        </p>
      )}

      {state.status === "success" && (
        <section aria-label={t.reviewTitle} className="flex flex-col gap-2 rounded-lg border border-dashed border-violet-300 bg-white p-3">
          <p className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-600">
            <AiBadge label={t.suggestion} /> {t.reviewHint}
          </p>
          {editing ? (
            <>
              <label htmlFor={draftId} className="sr-only">
                {t.editLabel}
              </label>
              <textarea
                id={draftId}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={5}
                className={`${inputClass} resize-y py-2 text-sm`}
              />
            </>
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{draft}</p>
          )}
          <AiNotice answer={state.data} />
          {state.data.sources.length > 0 && <SourceChips sources={state.data.sources} />}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={discard} className={smallButtonClass}>
              <X className="size-4" /> {t.discard}
            </button>
            {!editing && (
              <button type="button" onClick={() => setEditing(true)} className={smallButtonClass}>
                <Pencil className="size-4" /> {t.edit}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onAccept(draft.trim());
                discard();
              }}
              disabled={!draft.trim()}
              className={`${smallButtonClass} border-blue-600 bg-blue-600 text-white hover:bg-blue-700`}
            >
              <Check className="size-4" /> {t.accept}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
