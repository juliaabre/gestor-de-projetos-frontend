import { CalendarClock, Gauge } from "lucide-react";
import util from "@/lib/util.json";
import { fillTemplate, formatDate, isPastDate } from "@/lib/format";
import { TASK_COMPLEXITIES, TASK_PRIORITIES, type Task, type TaskComplexity, type TaskPriority } from "../types";

const t = util.tasks.badges;

const PRIORITY_STYLE: Record<TaskPriority, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-100 text-amber-800",
  URGENT: "bg-red-100 text-red-700",
};

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const label = TASK_PRIORITIES.find((p) => p.value === priority)?.label ?? priority;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLE[priority]}`}>
      {fillTemplate(t.priority, { value: label })}
    </span>
  );
}

export function ComplexityBadge({ complexity }: { complexity: TaskComplexity | null }) {
  if (!complexity) return null;
  const label = TASK_COMPLEXITIES.find((c) => c.value === complexity)?.label ?? String(complexity);
  const bars = complexity;
  return (
    <span className="flex items-center gap-1 text-xs text-slate-600">
      <Gauge className="size-3.5 text-slate-500" aria-hidden="true" />
      {fillTemplate(t.complexity, { value: `${complexity}/5 · ${label}` })}
      <span aria-hidden="true" className="ml-0.5 flex items-end gap-px">
        {[1, 2, 3, 4, 5].map((n) => (
          <span
            key={n}
            className={`w-1 rounded-sm ${n <= bars ? "bg-slate-500" : "bg-slate-200"}`}
            style={{ height: 3 + n * 1.5 }}
          />
        ))}
      </span>
    </span>
  );
}

export function DueDateBadge({ task, done }: { task: Task; done: boolean }) {
  if (!task.dueDate) return null;
  const overdue = !done && isPastDate(task.dueDate);
  return (
    <span
      className={`flex items-center gap-1 text-xs ${overdue ? "font-medium text-red-700" : "text-slate-600"}`}
    >
      <CalendarClock className="size-3.5" aria-hidden="true" />
      {fillTemplate(overdue ? t.overdue : t.dueDate, { date: formatDate(task.dueDate) })}
    </span>
  );
}

export function TechList({ technologies, max }: { technologies: string[]; max?: number }) {
  if (technologies.length === 0) return null;
  const visible = max ? technologies.slice(0, max) : technologies;
  const hidden = technologies.length - visible.length;
  return (
    <ul className="flex flex-wrap gap-1" aria-label={t.technologies}>
      {visible.map((tech) => (
        <li key={tech} className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] font-medium text-violet-700">
          {tech}
        </li>
      ))}
      {hidden > 0 && (
        <li className="px-1 text-[11px] text-slate-500" title={technologies.slice(visible.length).join(", ")}>
          +{hidden}
        </li>
      )}
    </ul>
  );
}
