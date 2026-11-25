import type { ReactNode } from "react";
import { BarChart3, BookOpen, CircleSlash, FileText, FolderKanban, Info, Sparkles, SquareCheck } from "lucide-react";
import util from "@/lib/util.json";
import { fillTemplate } from "@/lib/format";
import type { AiAnswer, AiSource } from "../types";

const t = util.ai.shared;

export function AiBadge({ label = t.badge }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
      <Sparkles className="size-3" aria-hidden="true" /> {label}
    </span>
  );
}

/** Aviso de IA indisponível: informa sem bloquear o restante da tela. */
export function AiUnavailable({ message, children }: { message: string; children?: ReactNode }) {
  return (
    <div role="status" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
      <p className="flex items-start gap-2">
        <CircleSlash className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden="true" />
        <span>{message}</span>
      </p>
      {children}
    </div>
  );
}

/**
 * Aviso do servidor quando a resposta é alternativa (sem síntese do modelo,
 * por exemplo com o provedor de IA desligado): os dados vêm das fontes.
 */
export function AiNotice({ answer }: { answer: Pick<AiAnswer, "fallback" | "notice"> }) {
  if (!answer.fallback && !answer.notice) return null;
  return (
    <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{answer.notice ?? t.fallbackNotice}</span>
    </p>
  );
}

/** Texto gerado pela IA, preservando quebras de linha. */
export function AiText({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{text}</p>;
}

const SOURCE_ICON = {
  TASK: SquareCheck,
  DOCUMENT: FileText,
  PROJECT: FolderKanban,
  INDICATORS: BarChart3,
  OTHER: BookOpen,
} as const;

export function SourceChips({
  sources,
  onOpenTask,
  label = t.sources,
}: {
  sources: AiSource[];
  onOpenTask?: (taskId: number) => void;
  label?: string;
}) {
  if (sources.length === 0) return <p className="text-xs italic text-slate-500">{t.noSources}</p>;
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={label}>
      {sources.map((source, index) => {
        const Icon = SOURCE_ICON[source.type];
        const text =
          source.type === "TASK" && source.id != null
            ? fillTemplate(t.taskSource, { id: source.id, title: source.title })
            : source.page != null
              ? fillTemplate(t.pageSource, { title: source.title, page: source.page })
              : source.title;
        const className =
          "inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700";
        return (
          <li key={`${source.ref}-${index}`} className="max-w-full">
            {source.type === "TASK" && source.id != null && onOpenTask ? (
              <button
                type="button"
                onClick={() => onOpenTask(source.id!)}
                title={source.excerpt ?? undefined}
                className={`${className} hover:border-blue-300 hover:text-blue-700`}
              >
                <Icon className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{text}</span>
              </button>
            ) : (
              <span className={className} title={source.excerpt ?? undefined}>
                <Icon className="size-3 shrink-0" aria-hidden="true" />
                <span className="truncate">{text}</span>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function ScoreBar({ score, highlight }: { score: number; highlight: boolean }) {
  return (
    <div
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={score}
      aria-label={fillTemplate(t.score, { score })}
      className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
    >
      <div className={`h-full rounded-full ${highlight ? "bg-blue-600" : "bg-blue-400"}`} style={{ width: `${score}%` }} />
    </div>
  );
}
