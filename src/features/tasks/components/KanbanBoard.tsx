import { useId, useRef, useState } from "react";
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
  canMoveTasks,
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
  /** Criar tarefas (gerente). */
  canEditTasks: boolean;
  /** Mover tarefas entre colunas (qualquer integrante). */
  canMoveTasks: boolean;
  canManageColumns: boolean;
  onOpenTask: (task: Task) => void;
  onMoveTask: (taskId: number, status: TaskStatus) => void;
  onCreateTask: (status: TaskStatus) => void;
  onEditColumn: (column: BoardColumn) => void;
  onSuggestAssignee?: (task: Task) => void;
}) {
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [overStatus, setOverStatus] = useState<TaskStatus | null>(null);

  const [activeIndex, setActiveIndex] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const idPrefix = useId();

  const memberById = new Map(team.map((member) => [member.id, member]));
  const countByStatus = new Map<TaskStatus, number>();
  for (const task of tasks)
    countByStatus.set(task.status, (countByStatus.get(task.status) ?? 0) + 1);

  /** Em telas pequenas as colunas ficam lado a lado com rolagem; o seletor leva direto a uma delas. */
  function goToColumn(index: number) {
    const section = scrollerRef.current?.children[index] as
      HTMLElement | undefined;
    if (!section) return;
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    section.scrollIntoView?.({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "nearest",
      inline: "start",
    });
    section.querySelector<HTMLElement>("h2")?.focus({ preventScroll: true });
    setActiveIndex(index);
  }

  function syncActiveColumn() {
    const scroller = scrollerRef.current;
    const first = scroller?.children[0] as HTMLElement | undefined;
    if (!scroller || !first) return;
    const step = first.offsetWidth + 16;
    if (step > 16)
      setActiveIndex(
        Math.min(columns.length - 1, Math.round(scroller.scrollLeft / step)),
      );
  }

  return (
    <div>
      <nav
        aria-label={t.columnNav}
        className="-mx-4 mb-3 overflow-x-auto scrollbar-none px-4 lg:hidden"
      >
        <ul className="flex gap-2">
          {columns.map((column, index) => (
            <li key={column.status} className="shrink-0">
              <button
                type="button"
                onClick={() => goToColumn(index)}
                aria-current={activeIndex === index ? "true" : undefined}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  activeIndex === index
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                }`}
              >
                {column.name} · {countByStatus.get(column.status) ?? 0}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div
        ref={scrollerRef}
        onScroll={syncActiveColumn}
        tabIndex={0}
        className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0"
        aria-label={t.boardLabel}
        role="region"
      >
        {columns.map((column, index) => {
          const columnTasks = tasks.filter(
            (task) => task.status === column.status,
          );
          const headingId = `${idPrefix}-column-${index}`;
          const isOver = overStatus === column.status && draggingId != null;

          return (
            <section
              key={column.status}
              data-status={column.status}
              aria-labelledby={headingId}
              onDragOver={(e) => {
                if (draggingId == null) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (overStatus !== column.status) setOverStatus(column.status);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  setOverStatus(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id =
                  Number(e.dataTransfer.getData("text/plain")) || draggingId;
                setOverStatus(null);
                setDraggingId(null);
                if (id) onMoveTask(id, column.status);
              }}
              className={`relative flex min-h-64 w-[85vw] max-w-80 shrink-0 snap-start flex-col rounded-2xl border p-3 transition sm:w-72 lg:max-h-[calc(100vh-16rem)] ${
                isOver
                  ? "border-blue-400 bg-blue-50/70"
                  : "border-slate-200 bg-slate-100/70"
              }`}
            >
              <header className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2
                  id={headingId}
                  tabIndex={-1}
                  className="flex min-w-0 outline-none items-center gap-2 text-sm font-semibold text-slate-800"
                >
                  <span className="truncate">{column.name}</span>
                  <span
                    className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-slate-600"
                    aria-label={fillTemplate(t.columnCount, {
                      count: columnTasks.length,
                    })}
                  >
                    {columnTasks.length}
                  </span>
                </h2>
                {canManageColumns && column.id != null && (
                  <button
                    type="button"
                    onClick={() => onEditColumn(column)}
                    aria-label={fillTemplate(t.editColumn, {
                      name: column.name,
                    })}
                    className="rounded-lg p-1.5 text-slate-500 hover:bg-white hover:text-slate-700"
                  >
                    <Pencil className="size-4" />
                  </button>
                )}
              </header>

              <ul className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {columnTasks.length === 0 && (
                  <li className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-xs text-slate-500">
                    {canMoveTasks ? t.emptyColumnDrop : t.emptyColumn}
                  </li>
                )}
                {columnTasks.map((task) => {
                  const done = isFinished(task);
                  return (
                    <li key={task.id}>
                      <TaskCard
                        task={task}
                        assignee={
                          task.assigneeId != null
                            ? (memberById.get(task.assigneeId) ?? null)
                            : null
                        }
                        columns={columns}
                        blockedBy={
                          done ? 0 : pendingDependencies(task, allTasks).length
                        }
                        done={done}
                        canMove={canMoveTasks}
                        moving={movingIds.has(task.id)}
                        dragging={draggingId === task.id}
                        onOpen={() => onOpenTask(task)}
                        onMove={(status) => onMoveTask(task.id, status)}
                        onSuggest={
                          onSuggestAssignee && !done
                            ? () => onSuggestAssignee(task)
                            : undefined
                        }
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
                    <span className="sr-only">
                      {" "}
                      {fillTemplate(t.inColumn, { name: column.name })}
                    </span>
                  </span>
                </button>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
