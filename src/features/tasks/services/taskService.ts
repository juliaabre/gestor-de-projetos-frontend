import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { toTask, toTaskRequest } from "../mappers";
import type { Task, TaskInput, TaskResponseDto, TaskStatus } from "../types";

export async function listTasks(): Promise<Task[]> {
  const { data } = await api.get<TaskResponseDto[]>(endpoints.tasks.base);
  return data.map(toTask);
}

export async function listProjectTasks(projectId: number): Promise<Task[]> {
  const { data } = await api.get<TaskResponseDto[]>(
    endpoints.tasks.byProject(projectId),
  );
  return data.map(toTask);
}

export async function getTask(id: number): Promise<Task> {
  const { data } = await api.get<TaskResponseDto>(endpoints.tasks.byId(id));
  return toTask(data);
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data } = await api.post<TaskResponseDto>(
    endpoints.tasks.base,
    toTaskRequest(input),
  );
  return toTask(data);
}

export async function updateTask(id: number, input: TaskInput): Promise<Task> {
  const { data } = await api.put<TaskResponseDto>(
    endpoints.tasks.byId(id),
    toTaskRequest(input),
  );
  return toTask(data);
}

export async function moveTask(task: Task, status: TaskStatus): Promise<Task> {
  return updateTask(task.id, {
    title: task.title,
    content: task.content ?? undefined,
    priority: task.priority,
    projectId: task.projectId,
    status,
  });
}

export async function deleteTask(id: number): Promise<void> {
  await api.delete(endpoints.tasks.byId(id));
}
