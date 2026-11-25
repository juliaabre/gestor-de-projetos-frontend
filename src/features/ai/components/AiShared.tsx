import type { ReactNode } from "react";
import { AlertTriangle, BookOpen, CircleSlash, FileText, FolderKanban, Link2, Sparkles, SquareCheck, UserRound } from "lucide-react";
import util from "@/lib/util.json";
import { fillTemplate } from "@/lib/format";
import type { AiSource, Bottleneck, BottleneckKind, Severity } from "../types";

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

const SOURCE_ICON = { TASK: SquareCheck, DOCUMENT: FileText, PROJECT: FolderKanban, OTHER: BookOpen } as const;

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
        const text = source.type === "TASK" && source.id != null ? fillTemplate(t.taskSource, { id: source.id, title: source.title }) : source.title;
        const className =
          "inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs text-slate-700";
        return (
          <li key={`${source.type}-${source.id ?? index}`} className="max-w-full">
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

const SEVERITY_STYLE: Record<Severity, string> = {
  LOW: "border-amber-200 bg-amber-50/60 text-amber-900",
  MEDIUM: "border-amber-300 bg-amber-50 text-amber-900",
  HIGH: "border-red-300 bg-red-50 text-red-900",
};

const KIND_LABEL: Record<BottleneckKind, string> = {
  STALLED_TASK: t.bottleneck.stalled,
  OVERLOADED_MEMBER: t.bottleneck.overloaded,
  BLOCKING_DEPENDENCY: t.bottleneck.blocking,
  OTHER: t.bottleneck.other,
};

export function BottleneckAlert({
  bottleneck,
  onOpenTask,
}: {
  bottleneck: Bottleneck;
  onOpenTask?: (taskId: number) => void;
}) {
  return (
    <div role="note" className={`rounded-xl border px-3 py-2.5 text-sm ${SEVERITY_STYLE[bottleneck.severity]}`}>
      <p className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          <strong className="font-semibold">
            {KIND_LABEL[bottleneck.kind]}
            {bottleneck.severity === "HIGH" && ` · ${t.bottleneck.high}`}:
          </strong>{" "}
          {bottleneck.description}
        </span>
      </p>
      {(bottleneck.tasks.length > 0 || bottleneck.members.length > 0) && (
        <ul className="mt-2 flex flex-wrap gap-1.5 pl-6" aria-label={t.bottleneck.involved}>
          {bottleneck.members.map((member) => (
            <li key={`u-${member.id}`} className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-xs">
              <UserRound className="size-3" aria-hidden="true" /> {member.username}
            </li>
          ))}
          {bottleneck.tasks.map((task) => (
            <li key={`t-${task.id}`}>
              {onOpenTask ? (
                <button
                  type="button"
                  onClick={() => onOpenTask(task.id)}
                  className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-xs underline-offset-2 hover:underline"
                >
                  <Link2 className="size-3" aria-hidden="true" />
                  {fillTemplate(t.taskSource, { id: task.id, title: task.title })}
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md bg-white/80 px-2 py-0.5 text-xs">
                  <Link2 className="size-3" aria-hidden="true" />
                  {fillTemplate(t.taskSource, { id: task.id, title: task.title })}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
