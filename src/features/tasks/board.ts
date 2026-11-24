import type { BoardColumn, Task, TaskStatus } from "./types";

export function resolveColumns(columns: BoardColumn[], tasks: Task[]): BoardColumn[] {
  const known = new Set(columns.map((c) => c.status));
  const extra: BoardColumn[] = [];
  for (const task of tasks) {
    if (!known.has(task.status)) {
      known.add(task.status);
      extra.push({
        id: null,
        name: task.status,
        status: task.status,
        order: columns.length + extra.length,
        custom: true,
      });
    }
  }
  return [...columns, ...extra];
}

export function dependentsOf(taskId: number, tasks: Task[]): Set<number> {
  const result = new Set<number>();
  const queue = [taskId];
  while (queue.length) {
    const current = queue.shift()!;
    for (const task of tasks) {
      if (task.dependencyIds.includes(current) && !result.has(task.id)) {
        result.add(task.id);
        queue.push(task.id);
      }
    }
  }
  return result;
}

export const DONE_STATUSES: TaskStatus[] = ["DONE", "CANCELLED"];

export function isFinished(task: Pick<Task, "status">) {
  return DONE_STATUSES.includes(task.status);
}

export function pendingDependencies(task: Task, tasks: Task[]): Task[] {
  return task.dependencyIds
    .map((id) => tasks.find((t) => t.id === id))
    .filter((t): t is Task => Boolean(t) && !isFinished(t!));
}

export function statusKeyFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
