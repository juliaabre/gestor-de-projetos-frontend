import { useCallback, useEffect, useRef, useState } from "react";
import { getErrorMessage, isUnavailable } from "@/lib/apiError";
import util from "@/lib/util.json";
import { getProject } from "@/features/projects/services/projectService";
import type { Project } from "@/features/projects/types";
import { DEFAULT_COLUMNS } from "../mappers";
import {
  listColumns,
  listProjectTasks,
  moveTask as moveTaskRequest,
} from "../services/taskService";
import type { BoardColumn, Task, TaskStatus } from "../types";

export interface BoardData {
  project: Project;
  tasks: Task[];
  columns: BoardColumn[];
  columnsAvailable: boolean;
}

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | ({ status: "success" } & BoardData);

async function loadColumns(projectId: number) {
  try {
    const columns = await listColumns(projectId);
    return { columns: columns.length ? columns : DEFAULT_COLUMNS, columnsAvailable: true };
  } catch (error) {
    if (isUnavailable(error)) return { columns: DEFAULT_COLUMNS, columnsAvailable: false };
    throw error;
  }
}

export function useProjectBoard(projectId: number) {
  const [state, setState] = useState<State>({ status: "loading" });
  const [movingIds, setMovingIds] = useState<Set<number>>(new Set());
  const stateRef = useRef(state);
  stateRef.current = state;

  const fetchAll = useCallback(async (): Promise<BoardData> => {
    const [project, tasks, columns] = await Promise.all([
      getProject(projectId),
      listProjectTasks(projectId),
      loadColumns(projectId),
    ]);
    return { project, tasks, ...columns };
  }, [projectId]);

  const reload = useCallback(() => {
    let active = true;
    setState({ status: "loading" });
    fetchAll()
      .then((data) => active && setState({ status: "success", ...data }))
      .catch(
        (error) =>
          active &&
          setState({
            status: "error",
            message: getErrorMessage(error, util.board.loadError),
          }),
      );
    return () => {
      active = false;
    };
  }, [fetchAll]);

  useEffect(reload, [reload]);

  const update = useCallback((fn: (data: BoardData) => Partial<BoardData>) => {
    setState((prev) => (prev.status === "success" ? { ...prev, ...fn(prev) } : prev));
  }, []);

  const upsertTask = useCallback(
    (task: Task) =>
      update(({ tasks }) => ({
        tasks: tasks.some((t) => t.id === task.id)
          ? tasks.map((t) => (t.id === task.id ? task : t))
          : [...tasks, task],
      })),
    [update],
  );

  const removeTask = useCallback(
    (taskId: number) =>
      update(({ tasks }) => ({
        tasks: tasks
          .filter((t) => t.id !== taskId)
          .map((t) =>
            t.dependencyIds.includes(taskId)
              ? { ...t, dependencyIds: t.dependencyIds.filter((id) => id !== taskId) }
              : t,
          ),
      })),
    [update],
  );

  const upsertColumn = useCallback(
    (column: BoardColumn) =>
      update(({ columns }) => ({
        columns: columns.some((c) => c.id != null && c.id === column.id)
          ? columns.map((c) => (c.id === column.id ? { ...column, order: c.order } : c))
          : [...columns, { ...column, order: columns.length }],
      })),
    [update],
  );

  const moveTask = useCallback(
    async (taskId: number, status: TaskStatus): Promise<Task | null> => {
      const current = stateRef.current;
      if (current.status !== "success") return null;
      const original = current.tasks.find((t) => t.id === taskId);
      if (!original || original.status === status) return null;

      const setStatus = (from: TaskStatus, to: TaskStatus) =>
        update(({ tasks }) => ({
          tasks: tasks.map((t) => (t.id === taskId && t.status === from ? { ...t, status: to } : t)),
        }));

      setMovingIds((prev) => new Set(prev).add(taskId));
      setStatus(original.status, status);
      try {
        const saved = await moveTaskRequest(original, status);
        upsertTask(saved);
        return saved;
      } catch (error) {
        setStatus(status, original.status);
        throw error;
      } finally {
        setMovingIds((prev) => {
          const next = new Set(prev);
          next.delete(taskId);
          return next;
        });
      }
    },
    [update, upsertTask],
  );

  return { state, reload, upsertTask, removeTask, upsertColumn, moveTask, movingIds };
}
