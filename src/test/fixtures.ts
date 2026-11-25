import { AxiosError, AxiosHeaders } from "axios";
import type { Project } from "@/features/projects/types";
import type { Task } from "@/features/tasks/types";

export function apiError(status: number, message?: string) {
  const headers = new AxiosHeaders();
  return new AxiosError("error", String(status), { headers }, null, {
    status,
    statusText: "",
    headers: {},
    config: { headers },
    data: message ? { status, mensagem: message } : "",
  });
}

export function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 10,
    name: "Sistema RAG",
    description: "Plataforma com IA",
    archived: false,
    creatorId: 1,
    managerId: 1,
    team: [
      { id: 1, username: "ana", email: "ana@ex.com" },
      { id: 2, username: "bia", email: "bia@ex.com" },
      { id: 3, username: "caio", email: "caio@ex.com" },
    ],
    teamIds: [1, 2, 3],
    taskIds: [],
    myRole: "MANAGER",
    canManage: true,
    canAddMembers: true,
    ...overrides,
  };
}

export function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 100,
    title: "Autenticação JWT",
    content: "Login e proteção das rotas",
    requirements: null,
    technologies: ["Spring Security"],
    status: "TODO",
    priority: "HIGH",
    complexity: 4,
    dueDate: null,
    assigneeId: null,
    dependencyIds: [],
    projectId: 10,
    ...overrides,
  };
}

/**
 * O backend devolve dependências em rota própria. Nos testes, responde com as
 * `dependencyIds` das tarefas que o mock de `listProjectTasks` devolveu.
 */
export function dependenciesFrom(listProjectTasks: { mock: { results: { value: unknown }[] } }) {
  return async (taskId: number) => {
    const last = listProjectTasks.mock.results[listProjectTasks.mock.results.length - 1];
    const tasks = ((await last?.value) ?? []) as Task[];
    return tasks.find((task) => task.id === taskId)?.dependencyIds ?? [];
  };
}
