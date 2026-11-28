import type {
  AttachmentDto,
  BoardColumn,
  ColumnDto,
  CommentDto,
  HistoryDto,
  Task,
  TaskAttachment,
  TaskAuthor,
  TaskComment,
  TaskComplexity,
  TaskHistoryEntry,
  TaskInput,
  TaskPriority,
  TaskPriorityDto,
  TaskRequestDto,
  TaskResponseDto,
  TaskStatus,
  TaskStatusDto,
} from "./types";
import { TASK_STATUSES } from "./types";

const STATUS_FROM_API: Record<TaskStatusDto, TaskStatus> = {
  PENDENTE: "TODO",
  EM_ANDAMENTO: "IN_PROGRESS",
  CONCLUIDA: "DONE",
  CANCELADA: "CANCELLED",
};

const PRIORITY_FROM_API: Record<TaskPriorityDto, TaskPriority> = {
  BAIXA: "LOW",
  MEDIA: "MEDIUM",
  ALTA: "HIGH",
  URGENTE: "URGENT",
};

function invert<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<V, K>;
}

const STATUS_TO_API = invert(STATUS_FROM_API) as Record<string, TaskStatusDto>;
const PRIORITY_TO_API = invert(PRIORITY_FROM_API);

function toComplexity(value: number | null | undefined): TaskComplexity | null {
  return value != null && Number.isInteger(value) && value >= 1 && value <= 5 ? (value as TaskComplexity) : null;
}

/** Status padrão são traduzidos; chaves de colunas personalizadas passam intactas. */
export function statusFromApi(status: string): TaskStatus {
  return STATUS_FROM_API[status as TaskStatusDto] ?? status;
}

export function statusToApi(status: TaskStatus): string {
  return STATUS_TO_API[status] ?? status;
}

export function toTask(dto: TaskResponseDto): Task {
  const status = statusFromApi(dto.status);
  return {
    id: dto.id,
    title: dto.titulo,
    content: dto.conteudo ?? null,
    requirements: dto.requisitos ?? null,
    technologies: dto.tecnologias ?? [],
    status,
    baseStatus: status,
    priority: PRIORITY_FROM_API[dto.prioridade] ?? "MEDIUM",
    complexity: toComplexity(dto.complexidade),
    dueDate: dto.prazo ? dto.prazo.slice(0, 10) : null,
    assigneeId: dto.responsavelId ?? null,
    // Dependências vêm de rota própria (`/dependencias`) e são preenchidas depois.
    dependencyIds: [],
    projectId: dto.projetoId,
    columnId: dto.colunaId ?? null,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

/** Coluna do quadro no servidor para onde a tarefa vai. */
export interface ColumnTarget {
  id: number;
  /** Status vinculado à coluna (formato da API), ou `null`. */
  apiStatus: string | null;
}

/**
 * Corpo do POST/PUT. Com `column`, a tarefa é posicionada nessa coluna: se a
 * coluna tiver status, a tarefa assume esse status; senão mantém o seu.
 */
export function toTaskRequest(input: TaskInput, column?: ColumnTarget): TaskRequestDto {
  const status = column
    ? (column.apiStatus ?? statusToApi(input.baseStatus ?? "TODO"))
    : statusToApi(input.status);
  return {
    titulo: input.title,
    conteudo: input.content,
    requisitos: input.requirements,
    tecnologias: input.technologies,
    status,
    prioridade: PRIORITY_TO_API[input.priority],
    complexidade: input.complexity === undefined ? undefined : (input.complexity ?? null),
    prazo: input.dueDate,
    responsavelId: input.assigneeId,
    projetoId: input.projectId,
    ...(column ? { colunaId: column.id } : {}),
  };
}

/** Converte uma tarefa existente na entrada completa do PUT, preservando todos os campos. */
export function taskToInput(task: Task, overrides: Partial<TaskInput> = {}): TaskInput {
  return {
    title: task.title,
    content: task.content ?? undefined,
    requirements: task.requirements ?? undefined,
    technologies: task.technologies,
    status: task.status,
    priority: task.priority,
    complexity: task.complexity,
    dueDate: task.dueDate,
    assigneeId: task.assigneeId,
    dependencyIds: task.dependencyIds,
    projectId: task.projectId,
    baseStatus: task.baseStatus,
    ...overrides,
  };
}

/** Chave de coluna sem status vinculado (ou com status repetido no quadro). */
export const columnKey = (columnId: number): TaskStatus => `COLUNA_${columnId}`;

/**
 * O quadro posiciona as tarefas pela chave `status` da coluna. Uma coluna com
 * status vinculado usa esse status como chave, e as tarefas com esse status
 * caem nela; as demais usam `COLUNA_{id}`.
 */
export function toColumn(dto: ColumnDto, index: number): BoardColumn {
  const status = dto.status ? statusFromApi(dto.status) : columnKey(dto.id);
  return {
    id: dto.id,
    name: dto.nome,
    status,
    order: dto.posicao ?? index,
    custom: !TASK_STATUSES.some((s) => s.value === status),
  };
}

/** Colunas na ordem do quadro; um status repetido vale só para a primeira coluna. */
export function toColumns(dtos: ColumnDto[]): BoardColumn[] {
  const used = new Set<TaskStatus>();
  return dtos
    .map(toColumn)
    .sort((a, b) => a.order - b.order)
    .map((column) => {
      if (used.has(column.status) && column.id != null) {
        return { ...column, status: columnKey(column.id), custom: true };
      }
      used.add(column.status);
      return column;
    });
}

export const DEFAULT_COLUMNS: BoardColumn[] = TASK_STATUSES.map((status, index) => ({
  id: null,
  name: status.label,
  status: status.value,
  order: index,
  custom: false,
}));

function author(id: number | null | undefined): TaskAuthor | null {
  return id != null ? { id, username: null } : null;
}

export function toComment(dto: CommentDto): TaskComment {
  return { id: dto.id, content: dto.texto, author: author(dto.autorId), createdAt: dto.criadoEm };
}

export function toAttachment(dto: AttachmentDto): TaskAttachment {
  return {
    id: dto.id,
    fileName: dto.nome,
    contentType: null,
    size: dto.tamanho ?? null,
    uploadedBy: author(dto.autorId),
    createdAt: dto.criadoEm,
  };
}

export function toHistoryEntry(dto: HistoryDto): TaskHistoryEntry {
  return {
    id: dto.id,
    action: dto.acao,
    actorId: dto.atorId ?? null,
    assigneeId: dto.responsavelId ?? null,
    status: dto.status ? statusFromApi(dto.status) : null,
    createdAt: dto.criadoEm,
  };
}
