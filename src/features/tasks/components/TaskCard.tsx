import { Link2, LoaderCircle, UserRound } from "lucide-react";
import util from "@/lib/util.json";
import { fillTemplate } from "@/lib/format";
import { Avatar } from "@/features/projects/components/Avatar";
import type { TeamMember } from "@/features/projects/types";
import type { BoardColumn, Task, TaskStatus } from "../types";
import { ComplexityBadge, DueDateBadge, PriorityBadge, TechList } from "./TaskBadges";

const t = util.board.card;

export function TaskCard({
  task,
  assignee,
  columns,
  blockedBy,
  done,
  canMove,
  moving,
  dragging,
  onOpen,
  onMove,
  onDragStart,
  onDragEnd,
}: {
  task: Task;
  assignee: TeamMember | null;
  columns: BoardColumn[];
  blockedBy: number;
  done: boolean;
  canMove: boolean;
  moving: boolean;
  dragging: boolean;
  onOpen: () => void;
  onMove: (status: TaskStatus) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const titleId = `task-${task.id}-title`;

  return (
    <article
      aria-labelledby={titleId}
      aria-busy={moving}
      draggable={canMove && !moving}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", String(task.id));
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      className={`group rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition ${
        canMove && !moving ? "cursor-grab active:cursor-grabbing" : ""
      } ${dragging ? "opacity-40" : ""} ${moving ? "opacity-70" : "hover:border-slate-300 hover:shadow"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h4 id={titleId} className="min-w-0 text-sm font-semibold leading-5 text-slate-900">
          <button
            type="button"
            onClick={onOpen}
            className="break-words text-left hover:text-blue-700 hover:underline focus-visible:underline"
          >
            {task.title}
          </button>
        </h4>
        {moving && (
          <LoaderCircle className="size-4 shrink-0 animate-spin text-slate-400" aria-label={t.moving} />
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <PriorityBadge priority={task.priority} />
        <ComplexityBadge complexity={task.complexity} />
      </div>

      {task.technologies.length > 0 && (
        <div className="mt-2">
          <TechList technologies={task.technologies} max={4} />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
          {assignee ? (
            <>
              <Avatar name={assignee.username} className="size-5 text-[9px]" />
              <span className="truncate">
                <span className="sr-only">{t.assignee}: </span>
                {assignee.username}
              </span>
            </>
          ) : (
            <>
              <UserRound className="size-4 text-slate-300" aria-hidden="true" />
              <span className="text-slate-400">{t.unassigned}</span>
            </>
          )}
        </span>
        <DueDateBadge task={task} done={done} />
      </div>

      {blockedBy > 0 && !done && (
        <p className="mt-2 flex items-center gap-1 text-xs font-medium text-amber-700">
          <Link2 className="size-3.5" aria-hidden="true" />
          {fillTemplate(t.blocked, { count: blockedBy })}
        </p>
      )}

      {canMove && (
        <label className="mt-3 flex items-center gap-2 border-t border-slate-100 pt-2 text-xs text-slate-500">
          <span aria-hidden="true">{t.moveTo}</span>
          <select
            value={task.status}
            disabled={moving}
            onChange={(e) => onMove(e.target.value)}
            aria-label={fillTemplate(t.moveLabel, { title: task.title })}
            className="h-7 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 text-xs text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            {columns.map((column) => (
              <option key={column.status} value={column.status}>
                {column.name}
              </option>
            ))}
          </select>
        </label>
      )}
    </article>
  );
}
