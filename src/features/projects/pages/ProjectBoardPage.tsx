import { useMemo, useState, type ReactNode } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bot, Columns3, KanbanSquare, Plus, Search, Users } from "lucide-react";
import { Header } from "@/components/Header";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FeedbackBanner, useFeedback } from "@/components/FeedbackBanner";
import { ErrorState, LoadingState } from "@/components/States";
import { inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useAuth } from "@/features/auth/hooks/AuthContext";
import type { User } from "@/features/auth/types";
import { AssistantPanel } from "@/features/ai/components/AssistantPanel";
import { RecommendationModal } from "@/features/ai/components/RecommendationModal";
import { SummaryPanel } from "@/features/ai/components/SummaryPanel";
import { TeamPanel } from "@/features/skills/components/TeamPanel";
import { taskToInput } from "@/features/tasks/mappers";
import { resolveColumns } from "@/features/tasks/board";
import { ColumnFormModal } from "@/features/tasks/components/ColumnFormModal";
import { KanbanBoard } from "@/features/tasks/components/KanbanBoard";
import { TaskDetailsModal } from "@/features/tasks/components/TaskDetailsModal";
import { TaskFormModal } from "@/features/tasks/components/TaskFormModal";
import { useProjectBoard } from "@/features/tasks/hooks/useProjectBoard";
import { deleteTask, updateTask } from "@/features/tasks/services/taskService";
import type { BoardColumn, Task, TaskStatus } from "@/features/tasks/types";
import { getErrorMessage } from "@/lib/apiError";
import { fillTemplate } from "@/lib/format";
import util from "@/lib/util.json";
import { getProjectPermissions } from "../permissions";

const t = util.board;
const UNASSIGNED = "none";

type Tab = "board" | "team" | "assistant";
const TAB_PARAM: Record<Tab, string | null> = { board: null, team: "equipe", assistant: "assistente" };
type View =
  | { kind: "details"; taskId: number }
  | { kind: "form"; task?: Task; status?: TaskStatus; returnTo?: number }
  | { kind: "delete"; task: Task }
  | { kind: "column"; column?: BoardColumn }
  | { kind: "recommend"; task: Task; returnTo?: number }
  | null;

export function ProjectBoardPage() {
  const { projectId: rawId } = useParams();
  const projectId = Number(rawId);
  const { user, logout } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: Tab =
    (Object.entries(TAB_PARAM).find(([, value]) => value && value === searchParams.get("aba"))?.[0] as Tab) ??
    "board";

  const { state, reload, upsertTask, removeTask, upsertColumn, moveTask, movingIds } =
    useProjectBoard(projectId);
  const { feedback, success, error, clear } = useFeedback();
  const [view, setView] = useState<View>(null);
  const [search, setSearch] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const data = state.status === "success" ? state : null;
  const columns = useMemo(
    () => (data ? resolveColumns(data.columns, data.tasks) : []),
    [data],
  );
  const filteredTasks = useMemo(() => {
    if (!data) return [];
    const query = search.trim().toLowerCase();
    return data.tasks.filter((task) => {
      if (assigneeFilter === UNASSIGNED && task.assigneeId != null) return false;
      if (assigneeFilter && assigneeFilter !== UNASSIGNED && String(task.assigneeId) !== assigneeFilter) {
        return false;
      }
      return (
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.technologies.some((tech) => tech.toLowerCase().includes(query))
      );
    });
  }, [data, search, assigneeFilter]);

  const setTab = (next: Tab) => {
    const value = TAB_PARAM[next];
    setSearchParams(value ? { aba: value } : {}, { replace: true });
  };

  const openTaskById = (taskId: number) => {
    if (data?.tasks.some((task) => task.id === taskId)) setView({ kind: "details", taskId });
    else error(t.feedback.taskNotFound);
  };

  const columnName = (status: TaskStatus) => columns.find((c) => c.status === status)?.name ?? status;

  const handleMove = async (taskId: number, status: TaskStatus) => {
    const task = data?.tasks.find((candidate) => candidate.id === taskId);
    if (!task || task.status === status || movingIds.has(taskId)) return;
    clear();
    try {
      const saved = await moveTask(taskId, status);
      if (saved) {
        success(fillTemplate(t.feedback.moved, { title: saved.title, column: columnName(saved.status) }));
      }
    } catch (err) {
      error(
        fillTemplate(t.feedback.moveError, {
          title: task.title,
          reason: getErrorMessage(err, t.feedback.moveErrorFallback),
        }),
      );
    }
  };

  if (!Number.isInteger(projectId) || projectId <= 0) {
    return (
      <Shell user={user} logout={logout}>
        <ErrorState title={t.notFound} />
      </Shell>
    );
  }

  if (state.status === "loading") {
    return (
      <Shell user={user} logout={logout}>
        <LoadingState label={t.loading} />
      </Shell>
    );
  }

  if (state.status === "error") {
    return (
      <Shell user={user} logout={logout}>
        <ErrorState title={t.loadError} message={state.message} onRetry={reload} />
      </Shell>
    );
  }

  const { project, tasks, columnsAvailable } = state;
  const permissions = getProjectPermissions(project, user);
  const detailsTask = view?.kind === "details" ? tasks.find((task) => task.id === view.taskId) : undefined;

  return (
    <Shell user={user} logout={logout}>
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="break-words text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {project.name}
            </h1>
            {project.archived && (
              <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                {util.projects.card.archivedBadge}
              </span>
            )}
          </div>
          {project.description && (
            <p className="mt-2 max-w-3xl text-slate-500">{project.description}</p>
          )}
          {project.archived && (
            <p className="mt-2 text-sm text-amber-700">{t.archivedNotice}</p>
          )}
        </div>
        {tab === "board" && (
          <div className="flex flex-col gap-2 sm:flex-row">
            {permissions.canManageColumns && columnsAvailable && (
              <button type="button" onClick={() => setView({ kind: "column" })} className={secondaryButtonClass}>
                <Columns3 className="size-4" /> {t.newColumn}
              </button>
            )}
            {permissions.canEditTasks && (
              <button type="button" onClick={() => setView({ kind: "form" })} className={primaryButtonClass}>
                <Plus className="size-4" /> {t.newTask}
              </button>
            )}
          </div>
        )}
      </div>

      <div role="tablist" aria-label={t.tabs.label} className="mt-6 flex gap-1 overflow-x-auto border-b border-slate-200">
        {(
          [
            ["board", t.tabs.board, KanbanSquare, tasks.length],
            ["team", t.tabs.team, Users, project.team.length],
            ["assistant", t.tabs.assistant, Bot, null],
          ] as const
        ).map(([key, label, Icon, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            id={`project-tab-${key}`}
            aria-selected={tab === key}
            aria-controls={`project-panel-${key}`}
            onClick={() => setTab(key)}
            className={`-mb-px flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium ${
              tab === key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {count != null && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{count}</span>
            )}
          </button>
        ))}
      </div>

      <section
        role="tabpanel"
        id={`project-panel-${tab}`}
        aria-labelledby={`project-tab-${tab}`}
        className="mt-6"
      >
        {tab === "team" && (
          <TeamPanel project={project} currentUserId={user?.id} permissions={permissions} />
        )}
        {tab === "assistant" && (
          <div className="flex flex-col gap-4">
            <FeedbackBanner feedback={view ? null : feedback} onClose={clear} />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
              <SummaryPanel projectId={project.id} onOpenTask={openTaskById} />
              <AssistantPanel projectId={project.id} onOpenTask={openTaskById} />
            </div>
          </div>
        )}
        {tab === "board" && (
          <div className="flex flex-col gap-4">
            <FeedbackBanner feedback={view ? null : feedback} onClose={clear} />

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative sm:max-w-sm sm:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t.filters.search}
                  aria-label={t.filters.search}
                  className={`${inputClass} h-10 pl-9 text-sm`}
                />
              </div>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                aria-label={t.filters.assignee}
                className={`${inputClass} h-10 text-sm sm:w-56`}
              >
                <option value="">{t.filters.allAssignees}</option>
                <option value={UNASSIGNED}>{t.filters.unassigned}</option>
                {project.team.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.id === user?.id ? fillTemplate(t.filters.me, { name: member.username }) : member.username}
                  </option>
                ))}
              </select>
            </div>

            {tasks.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm text-slate-500">
                {permissions.canEditTasks ? t.emptyBoard : t.emptyBoardReadOnly}
              </p>
            )}
            {tasks.length > 0 && filteredTasks.length === 0 && (
              <p className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-600">{t.filters.noResults}</p>
            )}
            <p className="text-xs text-slate-500 sm:hidden">{t.mobileHint}</p>

            <KanbanBoard
              columns={columns}
              tasks={filteredTasks}
              allTasks={tasks}
              team={project.team}
              movingIds={movingIds}
              canEditTasks={permissions.canEditTasks}
              canManageColumns={permissions.canManageColumns && columnsAvailable}
              onOpenTask={(task) => setView({ kind: "details", taskId: task.id })}
              onMoveTask={handleMove}
              onCreateTask={(status) => setView({ kind: "form", status })}
              onEditColumn={(column) => setView({ kind: "column", column })}
              onSuggestAssignee={
                permissions.canDecideAssignment ? (task) => setView({ kind: "recommend", task }) : undefined
              }
            />
          </div>
        )}
      </section>

      {detailsTask && (
        <TaskDetailsModal
          key={detailsTask.id}
          task={detailsTask}
          tasks={tasks}
          columns={columns}
          team={project.team}
          permissions={permissions}
          moving={movingIds.has(detailsTask.id)}
          banner={<FeedbackBanner feedback={feedback} onClose={clear} />}
          onClose={() => setView(null)}
          onEdit={() => setView({ kind: "form", task: detailsTask, returnTo: detailsTask.id })}
          onDelete={() => setView({ kind: "delete", task: detailsTask })}
          onMove={(status) => handleMove(detailsTask.id, status)}
          onOpenTask={(task) => setView({ kind: "details", taskId: task.id })}
          onSuggestAssignee={
            permissions.canDecideAssignment && detailsTask.assigneeId == null
              ? () => setView({ kind: "recommend", task: detailsTask, returnTo: detailsTask.id })
              : undefined
          }
          onRegisterDependencies={async (dependencyIds) => {
            const saved = await updateTask(detailsTask.id, taskToInput(detailsTask, { dependencyIds }));
            upsertTask(saved);
            success(fillTemplate(t.feedback.dependenciesRegistered, { title: saved.title }));
          }}
        />
      )}

      {view?.kind === "recommend" && (
        <RecommendationModal
          task={view.task}
          team={project.team}
          onClose={() => setView(view.returnTo ? { kind: "details", taskId: view.returnTo } : null)}
          onAssigned={(saved, assignee, warning) => {
            upsertTask(saved);
            setView(view.returnTo ? { kind: "details", taskId: saved.id } : null);
            const message = fillTemplate(t.feedback.assigned, { title: saved.title, name: assignee.username });
            if (warning) error(`${message} ${warning}`);
            else success(message);
          }}
          onRejected={() => {
            setView(view.returnTo ? { kind: "details", taskId: view.returnTo } : null);
            success(fillTemplate(t.feedback.recommendationRejected, { title: view.task.title }));
          }}
        />
      )}

      {view?.kind === "form" && (
        <TaskFormModal
          task={view.task}
          projectId={project.id}
          defaultStatus={view.status}
          columns={columns}
          team={project.team}
          tasks={tasks}
          onClose={() => setView(view.returnTo ? { kind: "details", taskId: view.returnTo } : null)}
          onSaved={(saved, mode) => {
            upsertTask(saved);
            setView(view.returnTo ? { kind: "details", taskId: saved.id } : null);
            success(fillTemplate(mode === "created" ? t.feedback.created : t.feedback.updated, { title: saved.title }));
          }}
        />
      )}

      {view?.kind === "delete" && (
        <ConfirmDialog
          title={t.deleteDialog.title}
          description={fillTemplate(t.deleteDialog.description, { title: view.task.title })}
          confirmLabel={t.deleteDialog.confirm}
          confirmingLabel={t.deleteDialog.confirming}
          getError={(err) => getErrorMessage(err, t.deleteDialog.error)}
          onClose={() => setView({ kind: "details", taskId: view.task.id })}
          onConfirm={async () => {
            await deleteTask(view.task.id);
            removeTask(view.task.id);
            setView(null);
            success(fillTemplate(t.feedback.deleted, { title: view.task.title }));
          }}
        />
      )}

      {view?.kind === "column" && (
        <ColumnFormModal
          projectId={project.id}
          column={view.column}
          columns={columns}
          onClose={() => setView(null)}
          onSaved={(column, mode) => {
            upsertColumn(column);
            setView(null);
            success(fillTemplate(mode === "created" ? t.feedback.columnCreated : t.feedback.columnUpdated, { name: column.name }));
          }}
        />
      )}
    </Shell>
  );
}

function Shell({
  user,
  logout,
  children,
}: {
  user: User | null;
  logout: () => void;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Header user={user} logout={logout} />
      <main className="mx-auto max-w-[96rem] px-4 py-8 sm:px-6">
        <Link
          to="/projects"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="size-4" /> {t.back}
        </Link>
        {children}
      </main>
    </div>
  );
}
