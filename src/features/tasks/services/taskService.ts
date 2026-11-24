import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import {
  taskToInput,
  toAttachment,
  toColumn,
  toComment,
  toHistoryEntry,
  toTask,
  toTaskRequest,
  statusToApi,
} from "../mappers";
import type {
  AttachmentDto,
  BoardColumn,
  ColumnDto,
  ColumnInput,
  CommentDto,
  HistoryDto,
  Task,
  TaskAttachment,
  TaskComment,
  TaskHistoryEntry,
  TaskInput,
  TaskResponseDto,
  TaskStatus,
} from "../types";

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
  return updateTask(task.id, taskToInput(task, { status }));
}

export async function deleteTask(id: number): Promise<void> {
  await api.delete(endpoints.tasks.byId(id));
}

export async function listColumns(projectId: number): Promise<BoardColumn[]> {
  const { data } = await api.get<ColumnDto[]>(endpoints.projects.columns(projectId));
  return data.map(toColumn).sort((a, b) => a.order - b.order);
}

export async function createColumn(
  projectId: number,
  input: ColumnInput,
): Promise<BoardColumn> {
  const { data } = await api.post<ColumnDto>(endpoints.projects.columns(projectId), {
    nome: input.name,
    status: input.status ? statusToApi(input.status) : undefined,
  });
  return toColumn(data, Number.MAX_SAFE_INTEGER);
}

export async function updateColumn(
  projectId: number,
  columnId: number,
  input: ColumnInput,
): Promise<BoardColumn> {
  const { data } = await api.put<ColumnDto>(
    endpoints.projects.columnById(projectId, columnId),
    {
      nome: input.name,
      status: input.status ? statusToApi(input.status) : undefined,
    },
  );
  return toColumn(data, Number.MAX_SAFE_INTEGER);
}

export async function listComments(taskId: number): Promise<TaskComment[]> {
  const { data } = await api.get<CommentDto[]>(endpoints.tasks.comments(taskId));
  return data.map(toComment);
}

export async function addComment(taskId: number, content: string): Promise<TaskComment> {
  const { data } = await api.post<CommentDto>(endpoints.tasks.comments(taskId), {
    conteudo: content,
  });
  return toComment(data);
}

export async function listAttachments(taskId: number): Promise<TaskAttachment[]> {
  const { data } = await api.get<AttachmentDto[]>(endpoints.tasks.attachments(taskId));
  return data.map(toAttachment);
}

export async function uploadAttachment(
  taskId: number,
  file: File,
): Promise<TaskAttachment> {
  const form = new FormData();
  form.append("arquivo", file);
  const { data } = await api.post<AttachmentDto>(
    endpoints.tasks.attachments(taskId),
    form,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return toAttachment(data);
}

export async function downloadAttachment(
  taskId: number,
  attachmentId: number,
): Promise<Blob> {
  const { data } = await api.get<Blob>(
    endpoints.tasks.attachmentDownload(taskId, attachmentId),
    { responseType: "blob" },
  );
  return data;
}

export async function listHistory(taskId: number): Promise<TaskHistoryEntry[]> {
  const { data } = await api.get<HistoryDto[]>(endpoints.tasks.history(taskId));
  return data.map(toHistoryEntry);
}
