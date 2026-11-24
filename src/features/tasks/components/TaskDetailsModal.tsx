import { useState, type ReactNode } from "react";
import { ArrowRight, CheckCircle2, Circle, LoaderCircle, Pencil, Trash2 } from "lucide-react";
import { Modal } from "@/components/Modal";
import { dangerSmallButtonClass, smallButtonClass } from "@/components/ui";
import { fillTemplate, formatDateTime } from "@/lib/format";
import util from "@/lib/util.json";
import { Avatar } from "@/features/projects/components/Avatar";
import type { ProjectPermissions } from "@/features/projects/permissions";
import type { TeamMember } from "@/features/projects/types";
import { isFinished } from "../board";
import type { BoardColumn, Task, TaskStatus } from "../types";
import { ACTIVITY_TABS, AttachmentsSection, CommentsSection, HistorySection } from "./TaskActivity";
import { ComplexityBadge, DueDateBadge, PriorityBadge, TechList } from "./TaskBadges";

const t = util.tasks.details;
type Tab = (typeof ACTIVITY_TABS)[number]["key"];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Text({ value, empty }: { value: string | null; empty: string }) {
  return value ? (
    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{value}</p>
  ) : (
    <p className="text-sm italic text-slate-400">{empty}</p>
  );
}

function DependencyList({
  label,
  items,
  columnName,
  onOpen,
}: {
  label: string;
  items: Task[];
  columnName: (status: TaskStatus) => string;
  onOpen: (task: Task) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-slate-600">{label}</p>
      <ul className="flex flex-col gap-1.5" aria-label={label}>
        {items.map((item) => {
          const done = isFinished(item);
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => onOpen(item)}
                className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                {done ? (
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Circle className="size-4 shrink-0 text-amber-500" aria-hidden="true" />
                )}
                <span className={`min-w-0 flex-1 truncate ${done ? "text-slate-500 line-through" : "text-slate-800"}`}>
                  {item.title}
                </span>
                <span className="shrink-0 text-xs text-slate-500">{columnName(item.status)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function TaskDetailsModal({
  task,
  tasks,
  columns,
  team,
  permissions,
  moving,
  banner,
  onClose,
  onEdit,
  onDelete,
  onMove,
  onOpenTask,
}: {
  task: Task;
  tasks: Task[];
  columns: BoardColumn[];
  team: TeamMember[];
  permissions: ProjectPermissions;
  moving: boolean;
  banner?: ReactNode;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onMove: (status: TaskStatus) => void;
  onOpenTask: (task: Task) => void;
}) {
  const [tab, setTab] = useState<Tab>("comments");
  const assignee = team.find((member) => member.id === task.assigneeId) ?? null;
  const columnName = (status: TaskStatus) => columns.find((c) => c.status === status)?.name ?? status;

  const dependsOn = task.dependencyIds
    .map((id) => tasks.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is Task => Boolean(candidate));
  const blocks = tasks.filter((candidate) => candidate.dependencyIds.includes(task.id));

  return (
    <Modal title={task.title} onClose={onClose} size="lg">
      <div className="flex flex-col gap-6">
        {banner}
        <div className="flex flex-wrap items-center gap-2">
          {permissions.canEditTasks ? (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              {t.status}
              <select
                value={task.status}
                disabled={moving}
                onChange={(e) => onMove(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm font-medium text-slate-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                {columns.map((column) => (
                  <option key={column.status} value={column.status}>
                    {column.name}
                  </option>
                ))}
              </select>
              {moving && <LoaderCircle className="size-4 animate-spin" aria-label={t.moving} />}
            </label>
          ) : (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
              {columnName(task.status)}
            </span>
          )}
          <div className="ml-auto flex gap-2">
            {permissions.canEditTasks && (
              <button type="button" onClick={onEdit} className={smallButtonClass}>
                <Pencil className="size-4" /> {t.edit}
              </button>
            )}
            {permissions.canDeleteTasks && (
              <button type="button" onClick={onDelete} className={dangerSmallButtonClass}>
                <Trash2 className="size-4" /> {t.delete}
              </button>
            )}
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-slate-500">{t.assignee}</dt>
            <dd className="mt-1 flex items-center gap-2 font-medium text-slate-800">
              {assignee ? (
                <>
                  <Avatar name={assignee.username} className="size-6 text-[10px]" />
                  {assignee.username}
                </>
              ) : (
                <span className="font-normal text-slate-400">{t.unassigned}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.dueDate}</dt>
            <dd className="mt-1">
              {task.dueDate ? (
                <DueDateBadge task={task} done={isFinished(task)} />
              ) : (
                <span className="text-slate-400">{t.noDueDate}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.priority}</dt>
            <dd className="mt-1">
              <PriorityBadge priority={task.priority} />
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{t.complexity}</dt>
            <dd className="mt-1">
              {task.complexity ? (
                <ComplexityBadge complexity={task.complexity} />
              ) : (
                <span className="text-slate-400">{t.noComplexity}</span>
              )}
            </dd>
          </div>
          {(task.createdAt || task.updatedAt) && (
            <div className="text-xs text-slate-500 sm:col-span-2">
              {task.createdAt && fillTemplate(t.createdAt, { date: formatDateTime(task.createdAt) })}
              {task.createdAt && task.updatedAt && " · "}
              {task.updatedAt && fillTemplate(t.updatedAt, { date: formatDateTime(task.updatedAt) })}
            </div>
          )}
        </dl>

        <Section title={t.description}>
          <Text value={task.content} empty={t.noDescription} />
        </Section>

        <Section title={t.requirements}>
          <Text value={task.requirements} empty={t.noRequirements} />
        </Section>

        <Section title={t.technologies}>
          {task.technologies.length ? (
            <TechList technologies={task.technologies} />
          ) : (
            <p className="text-sm italic text-slate-400">{t.noTechnologies}</p>
          )}
        </Section>

        <Section title={t.dependencies}>
          {dependsOn.length === 0 && blocks.length === 0 ? (
            <p className="text-sm italic text-slate-400">{t.noDependencies}</p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {dependsOn.length > 0 && (
                <DependencyList label={t.dependsOn} items={dependsOn} columnName={columnName} onOpen={onOpenTask} />
              )}
              {blocks.length > 0 && (
                <DependencyList label={t.blocks} items={blocks} columnName={columnName} onOpen={onOpenTask} />
              )}
            </div>
          )}
          {permissions.canEditTasks && (
            <button
              type="button"
              onClick={onEdit}
              className="flex w-fit items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              {t.manageDependencies} <ArrowRight className="size-4" />
            </button>
          )}
        </Section>

        <div>
          <div role="tablist" aria-label={t.activity} className="flex gap-1 border-b border-slate-200">
            {ACTIVITY_TABS.map(({ key, icon: Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`task-tab-${key}`}
                aria-selected={tab === key}
                aria-controls={`task-panel-${key}`}
                onClick={() => setTab(key)}
                className={`-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium ${
                  tab === key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Icon className="size-4" aria-hidden="true" />
                {t.tabs[key]}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`task-panel-${tab}`} aria-labelledby={`task-tab-${tab}`} className="pt-4">
            {tab === "comments" && (
              <CommentsSection taskId={task.id} canComment={permissions.canCollaborate} />
            )}
            {tab === "attachments" && (
              <AttachmentsSection taskId={task.id} canUpload={permissions.canCollaborate} />
            )}
            {tab === "history" && <HistorySection taskId={task.id} />}
          </div>
        </div>
      </div>
    </Modal>
  );
}
