import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import util from "@/lib/util.json";
import { fillTemplate } from "@/lib/format";
import type { TeamMember } from "@/features/projects/types";
import { isFinished, pendingDependencies } from "../board";
import type { BoardColumn, Task, TaskStatus } from "../types";
import { TaskCard } from "./TaskCard";

const t = util.board;

export function KanbanBoard({
  columns,
  tasks,
  allTasks,
  team,
  movingIds,
  canEditTasks,
  canManageColumns,
  onOpenTask,
  onMoveTask,
  onCreateTask,
  onEditColumn,
  onSuggestAssignee,
}: {
  columns: BoardColumn[];
  tasks: Task[];
  allTasks: Task[];
  team: TeamMember[];
  movingIds: Set<number>;
  canEditTasks: boolean;
  canManageColumns: boolean;
  onOpenTask: (task: Task) => void;
  onMoveTask: (taskId: number, status: TaskStatus) => void;
  onCreateTask: (status: TaskStatus) => void;
  onEditColumn: (column: BoardColumn) => void;
  onSuggestAssignee?: (task: Task) => void;
}) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  const memberById = new Map(team.map((member) => [member.id, member]));

  return (
    <div
      className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0"
      aria-label={t.boardLabel}
      role="region"
    >
      {columns.map((column) => {
        const columnTasks = tasks.filter((task) => task.status === column.status);
        const headingId = `column-${column.status}`;
        const isOver = overStatus === column.status && draggingId != null;

        return (
          <section
            key={column.status}
            aria-labelledby={headingId}
            onDragOver={(e) => {
              if (draggingId == null) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overStatus !== column.status) setOverStatus(column.status);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOverStatus(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = Number(e.dataTransfer.getData("text/plain")) || draggingId;
              setOverStatus(null);
              setDraggingId(null);
              if (id) onMoveTask(id, column.status);
            }}
            className={`flex max-h-[calc(100vh-16rem)] min-h-64 w-[85vw] shrink-0 snap-start flex-col rounded-2xl border p-3 transition sm:w-72 ${
              isOver ? "border-blue-400 bg-blue-50/70" : "border-slate-200 bg-slate-100/70"
            }`}
          >
            <header className="mb-3 flex items-center justify-between gap-2 px-1">
              <h3 id={headingId} className="flex min-w-0 items-center gap-2 text-sm font-semibold text-slate-800">
                <span className="truncate">{column.name}</span>
                <span
                  className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600"
                  aria-label={fillTemplate(t.columnCount, { count: columnTasks.length })}
                >
                  {columnTasks.length}
                </span>
              </h3>
              {canManageColumns && column.id != null && (
                <button
                  type="button"
                  onClick={() => onEditColumn(column)}
                  aria-label={fillTemplate(t.editColumn, { name: column.name })}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
                >
                  <Pencil className="size-4" />
                </button>
              )}
            </header>

            <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
              {columnTasks.length === 0 && (
                <li className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-400">
                  {canEditTasks ? t.emptyColumnDrop : t.emptyColumn}
                </li>
              )}
              {columnTasks.map((task) => {
                const done = isFinished(task);
                return (
                  <li key={task.id}>
                    <TaskCard
                      task={task}
                      assignee={task.assigneeId != null ? (memberById.get(task.assigneeId) ?? null) : null}
                      columns={columns}
                      blockedBy={done ? 0 : pendingDependencies(task, allTasks).length}
                      done={done}
                      canMove={canEditTasks}
                      moving={movingIds.has(task.id)}
                      dragging={draggingId === task.id}
                      onOpen={() => onOpenTask(task)}
                      onMove={(status) => onMoveTask(task.id, status)}
                      onSuggest={onSuggestAssignee && !done ? () => onSuggestAssignee(task) : undefined}
                      onDragStart={() => setDraggingId(task.id)}
                      onDragEnd={() => {
                        setDraggingId(null);
                        setOverStatus(null);
                      }}
                    />
                  </li>
                );
              })}
            </ul>

            {canEditTasks && (
              <button
                type="button"
                onClick={() => onCreateTask(column.status)}
                className="mt-2 flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium text-slate-600 hover:bg-white hover:text-slate-900"
              >
                <Plus className="size-4" />
                <span>
                  {t.addTask}
                  <span className="sr-only"> {fillTemplate(t.inColumn, { name: column.name })}</span>
                </span>
              </button>
            )}
          </section>
        );
      })}
    </div>
  );
}
