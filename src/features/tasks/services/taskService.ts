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
  PrerequisiteDto,
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
  const task = toTask(data);
  return { ...task, dependencyIds: await syncDependencies(task.id, input.dependencyIds, []) };
}

export async function updateTask(id: number, input: TaskInput): Promise<Task> {
  const { data } = await api.put<TaskResponseDto>(
    endpoints.tasks.byId(id),
    toTaskRequest(input),
  );
  return { ...toTask(data), dependencyIds: await syncDependencies(id, input.dependencyIds) };
}

/**
 * Dependências ficam em rotas próprias: depois de salvar a tarefa, aplica a
 * diferença. Se essa etapa falhar, devolve o que o servidor tem, e a tela
 * avisa que as dependências não foram gravadas.
 */
async function syncDependencies(taskId: number, desired?: number[], known?: number[]): Promise<number[]> {
  try {
    const current = known ?? (await listDependencies(taskId));
    if (desired === undefined) return current;
    return await setDependencies(taskId, current, desired);
  } catch {
    return listDependencies(taskId).catch(() => known ?? []);
  }
}

/**
 * Muda só o status (`PATCH /status`), permitido a qualquer integrante da
 * equipe; editar a tarefa inteira exige ser gerente do projeto.
 */
export async function moveTask(task: Task, status: TaskStatus): Promise<Task> {
  const { data } = await api.patch<TaskResponseDto>(endpoints.tasks.status(task.id), null, {
    params: { novoStatus: statusToApi(status) },
  });
  return { ...toTask(data), dependencyIds: task.dependencyIds };
}

/** Ids dos pré-requisitos da tarefa. */
export async function listDependencies(taskId: number): Promise<number[]> {
  const { data } = await api.get<PrerequisiteDto[]>(endpoints.tasks.dependencies(taskId));
  return data.map((item) => item.id);
}

/** Aplica a diferença entre as dependências atuais e as desejadas. */
export async function setDependencies(taskId: number, current: number[], next: number[]): Promise<number[]> {
  const toAdd = next.filter((id) => !current.includes(id));
  const toRemove = current.filter((id) => !next.includes(id));
  for (const id of toAdd) await api.put(endpoints.tasks.dependency(taskId, id));
  for (const id of toRemove) await api.delete(endpoints.tasks.dependency(taskId, id));
  return next;
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

/** Grava a nova ordem das colunas (ids da esquerda para a direita). */
export async function reorderColumns(projectId: number, columnIds: number[]): Promise<BoardColumn[]> {
  const { data } = await api.put<ColumnDto[]>(endpoints.projects.columnOrder(projectId), {
    colunaIds: columnIds,
  });
  return data.map(toColumn).sort((a, b) => a.order - b.order);
}

/** Exclui a coluna; as tarefas dela vão para a coluna `moveTo` (obrigatória se houver tarefas). */
export async function deleteColumn(
  projectId: number,
  columnId: number,
  moveTo?: TaskStatus,
): Promise<void> {
  await api.delete(endpoints.projects.columnById(projectId, columnId), {
    params: moveTo ? { moverPara: statusToApi(moveTo) } : undefined,
  });
}

export async function listComments(taskId: number): Promise<TaskComment[]> {
  const { data } = await api.get<CommentDto[]>(endpoints.tasks.comments(taskId));
  return data.map(toComment);
}

export async function addComment(taskId: number, content: string): Promise<TaskComment> {
  const { data } = await api.post<CommentDto>(endpoints.tasks.comments(taskId), {
    texto: content,
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
    endpoints.tasks.attachmentById(taskId, attachmentId),
    { responseType: "blob" },
  );
  return data;
}

export async function deleteAttachment(taskId: number, attachmentId: number): Promise<void> {
  await api.delete(endpoints.tasks.attachmentById(taskId, attachmentId));
}

export async function listHistory(taskId: number): Promise<TaskHistoryEntry[]> {
  const { data } = await api.get<HistoryDto[]>(endpoints.tasks.history(taskId));
  return data.map(toHistoryEntry);
}
