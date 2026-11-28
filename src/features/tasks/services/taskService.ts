import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import {
  taskToInput,
  toAttachment,
  toColumns,
  toComment,
  toHistoryEntry,
  toTask,
  toTaskRequest,
  statusFromApi,
  statusToApi,
  type ColumnTarget,
} from "../mappers";
import type {
  AttachmentDto,
  BoardColumn,
  BoardDto,
  ColumnConfigDto,
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
import { TASK_STATUSES } from "../types";

// ------------------------------------------------------------ quadro e colunas

/**
 * Quadro de cada projeto já carregado (`null`: o projeto ainda não tem
 * quadro). Serve para posicionar as tarefas nas colunas sem uma requisição a
 * mais por tarefa; as alterações de colunas sempre releem o quadro antes.
 */
const boards = new Map<number, BoardDto | null>();

const DEFAULT_BOARD_NAME = "Quadro";

/** Colunas criadas junto com o primeiro quadro do projeto. */
const DEFAULT_BOARD_COLUMNS: ColumnConfigDto[] = TASK_STATUSES.map((status) => ({
  nome: status.label,
  status: statusToApi(status.value),
}));

async function fetchBoard(projectId: number): Promise<BoardDto | null> {
  const { data } = await api.get<BoardDto[]>(endpoints.projects.boards(projectId));
  // O projeto usa um quadro; havendo mais de um, vale o mais antigo.
  const board = [...data].sort((a, b) => a.id - b.id)[0] ?? null;
  boards.set(projectId, board);
  return board;
}

async function requireBoard(projectId: number): Promise<BoardDto> {
  const board = await fetchBoard(projectId);
  if (!board) throw new Error("O projeto ainda não tem quadro.");
  return board;
}

async function saveBoard(
  projectId: number,
  board: BoardDto | null,
  colunas: ColumnConfigDto[],
  realocacoes?: Record<number, number>,
): Promise<BoardDto> {
  const body = { nome: board?.nome ?? DEFAULT_BOARD_NAME, colunas, ...(realocacoes ? { realocacoes } : {}) };
  const { data } = board
    ? await api.put<BoardDto>(endpoints.projects.board(projectId, board.id), body)
    : await api.post<BoardDto>(endpoints.projects.boards(projectId), body);
  boards.set(projectId, data);
  return data;
}

const keepColumn = (column: ColumnDto): ColumnConfigDto => ({
  id: column.id,
  nome: column.nome,
  status: column.status ?? null,
});

function cachedColumns(projectId: number): BoardColumn[] {
  const board = boards.get(projectId);
  return board ? toColumns(board.colunas) : [];
}

/** Coluna do quadro com a chave `status`, se o projeto tiver quadro. */
function columnTarget(projectId: number, status: TaskStatus): ColumnTarget | undefined {
  const column = cachedColumns(projectId).find((c) => c.status === status && c.id != null);
  if (!column || column.id == null) return undefined;
  const dto = boards.get(projectId)!.colunas.find((c) => c.id === column.id);
  return { id: column.id, apiStatus: dto?.status ?? null };
}

/** Põe a tarefa na coluna em que ela está no servidor. */
function place(task: Task): Task {
  if (task.columnId == null) return task;
  const column = cachedColumns(task.projectId).find((c) => c.id === task.columnId);
  return column ? { ...task, status: column.status } : task;
}

// ------------------------------------------------------------------- tarefas

export async function listTasks(): Promise<Task[]> {
  const { data } = await api.get<TaskResponseDto[]>(endpoints.tasks.base);
  return data.map(toTask).map(place);
}

export async function listProjectTasks(projectId: number): Promise<Task[]> {
  const { data } = await api.get<TaskResponseDto[]>(
    endpoints.tasks.byProject(projectId),
  );
  return data.map(toTask).map(place);
}

export async function getTask(id: number): Promise<Task> {
  const { data } = await api.get<TaskResponseDto>(endpoints.tasks.byId(id));
  return place(toTask(data));
}

export async function createTask(input: TaskInput): Promise<Task> {
  const { data } = await api.post<TaskResponseDto>(
    endpoints.tasks.base,
    toTaskRequest(input, columnTarget(input.projectId, input.status)),
  );
  const task = place(toTask(data));
  return { ...task, dependencyIds: await syncDependencies(task.id, input.dependencyIds, []) };
}

export async function updateTask(id: number, input: TaskInput): Promise<Task> {
  const { data } = await api.put<TaskResponseDto>(
    endpoints.tasks.byId(id),
    toTaskRequest(input, columnTarget(input.projectId, input.status)),
  );
  return { ...place(toTask(data)), dependencyIds: await syncDependencies(id, input.dependencyIds) };
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
 * Move a tarefa para a coluna `status`, permitido a qualquer integrante da
 * equipe (editar a tarefa inteira exige ser gerente do projeto). Com quadro,
 * usa `PATCH /coluna`, que registra o histórico e aplica o status da coluna;
 * sem quadro, muda só o status (`PATCH /status`).
 */
export async function moveTask(task: Task, status: TaskStatus): Promise<Task> {
  const column = columnTarget(task.projectId, status);
  const { data } = column
    ? await api.patch<TaskResponseDto>(endpoints.tasks.column(task.id), null, {
        params: { colunaId: column.id },
      })
    : await api.patch<TaskResponseDto>(endpoints.tasks.status(task.id), null, {
        params: { novoStatus: statusToApi(status) },
      });
  return { ...place(toTask(data)), dependencyIds: task.dependencyIds };
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

/** Colunas do quadro do projeto; vazio se o projeto ainda não tem quadro. */
export async function listColumns(projectId: number): Promise<BoardColumn[]> {
  const board = await fetchBoard(projectId);
  return board ? toColumns(board.colunas) : [];
}

/**
 * Acrescenta uma coluna ao final do quadro. No primeiro uso, cria o quadro
 * com as colunas padrão (com status vinculado) e a nova coluna.
 */
export async function createColumn(
  projectId: number,
  input: ColumnInput,
): Promise<BoardColumn> {
  const board = await fetchBoard(projectId);
  const current = board ? board.colunas.map(keepColumn) : DEFAULT_BOARD_COLUMNS;
  const name = input.name.trim();
  const saved = await saveBoard(projectId, board, [...current, { nome: name, status: null }]);
  // O servidor recusa nomes repetidos no quadro, então o nome identifica a nova coluna.
  const created = toColumns(saved.colunas).find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (!created) throw new Error("A coluna criada não voltou na resposta do servidor.");
  return created;
}

export async function updateColumn(
  projectId: number,
  columnId: number,
  input: ColumnInput,
): Promise<BoardColumn> {
  const board = await requireBoard(projectId);
  const saved = await saveBoard(
    projectId,
    board,
    board.colunas.map((c) => (c.id === columnId ? { ...keepColumn(c), nome: input.name.trim() } : keepColumn(c))),
  );
  const updated = toColumns(saved.colunas).find((c) => c.id === columnId);
  if (!updated) throw new Error("A coluna editada não voltou na resposta do servidor.");
  return updated;
}

/** Grava a nova ordem das colunas (ids da esquerda para a direita). */
export async function reorderColumns(projectId: number, columnIds: number[]): Promise<BoardColumn[]> {
  const board = await requireBoard(projectId);
  const position = (id: number) => {
    const index = columnIds.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const ordered = [...board.colunas].sort((a, b) => position(a.id) - position(b.id));
  const saved = await saveBoard(projectId, board, ordered.map(keepColumn));
  return toColumns(saved.colunas);
}

/**
 * Exclui a coluna; as tarefas dela vão para a coluna `moveTo` (obrigatória
 * se houver tarefas). Tarefas que estão na coluna só pelo status, sem vínculo
 * gravado, são vinculadas a ela antes, para que o servidor as realoque junto.
 */
export async function deleteColumn(
  projectId: number,
  columnId: number,
  moveTo?: TaskStatus,
): Promise<void> {
  const board = await requireBoard(projectId);
  const columns = toColumns(board.colunas);
  const removed = columns.find((c) => c.id === columnId);
  const target = moveTo ? columns.find((c) => c.status === moveTo && c.id !== columnId) : undefined;
  if (moveTo && (!target || target.id == null)) {
    throw new Error("A coluna de destino não está no quadro.");
  }

  if (target && removed && !removed.custom) {
    const { data } = await api.get<TaskResponseDto[]>(endpoints.tasks.byProject(projectId));
    const loose = data.filter((t) => t.colunaId == null && statusFromApi(t.status) === removed.status);
    for (const task of loose) {
      await api.patch(endpoints.tasks.column(task.id), null, { params: { colunaId: columnId } });
    }
  }

  await saveBoard(
    projectId,
    board,
    board.colunas.filter((c) => c.id !== columnId).map(keepColumn),
    target ? { [columnId]: target.id! } : undefined,
  );
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
