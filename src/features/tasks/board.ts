import util from "@/lib/util.json";
import type { BoardColumn, Task, TaskInput, TaskStatus } from "./types";

/**
 * Colunas personalizadas dependem de o backend ligar colunas a tarefas (hoje
 * os quadros só guardam nomes e a tarefa tem status fixo). Até lá ficam
 * desligadas; a simulação (`pnpm dev:mock`) e os testes as habilitam, e
 * `VITE_CUSTOM_COLUMNS=true` liga quando o backend oferecer o recurso.
 */
export function customColumnsEnabled(): boolean {
  const env = import.meta.env;
  return env.VITE_CUSTOM_COLUMNS === "true" || env.MODE === "mock" || env.MODE === "test";
}

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

const sameList = (a: readonly (string | number)[] = [], b: readonly (string | number)[] = []) =>
  a.length === b.length && [...a].map(String).sort().join("\u0000") === [...b].map(String).sort().join("\u0000");

/**
 * Campos enviados que não voltaram na resposta do servidor, ou seja, que ele
 * não gravou (ex.: backend que ainda não guarda responsável ou prazo). Assim a
 * tela avisa em vez de dizer que tudo foi salvo.
 */
export function unsavedTaskFields(input: TaskInput, saved: Task): string[] {
  const labels = util.board.unsavedFields;
  const missing: string[] = [];
  if (input.assigneeId !== undefined && (input.assigneeId ?? null) !== (saved.assigneeId ?? null)) {
    missing.push(labels.assignee);
  }
  if (input.dueDate !== undefined && (input.dueDate || null) !== (saved.dueDate || null)) {
    missing.push(labels.dueDate);
  }
  if (input.complexity !== undefined && (input.complexity || null) !== (saved.complexity || null)) {
    missing.push(labels.complexity);
  }
  if (input.requirements !== undefined && (input.requirements?.trim() || null) !== (saved.requirements?.trim() || null)) {
    missing.push(labels.requirements);
  }
  if (input.technologies !== undefined && !sameList(input.technologies, saved.technologies)) {
    missing.push(labels.technologies);
  }
  if (input.dependencyIds !== undefined && !sameList(input.dependencyIds, saved.dependencyIds)) {
    missing.push(labels.dependencies);
  }
  return missing;
}
