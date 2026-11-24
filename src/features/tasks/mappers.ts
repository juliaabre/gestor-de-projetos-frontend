import type {
  AttachmentDto,
  AuthorDto,
  BoardColumn,
  ColumnDto,
  CommentDto,
  HistoryDto,
  Task,
  TaskAttachment,
  TaskAuthor,
  TaskComment,
  TaskComplexity,
  TaskComplexityDto,
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

const COMPLEXITY_FROM_API: Record<TaskComplexityDto, TaskComplexity> = {
  BAIXA: "LOW",
  MEDIA: "MEDIUM",
  ALTA: "HIGH",
};

function invert<K extends string, V extends string>(map: Record<K, V>): Record<V, K> {
  return Object.fromEntries(Object.entries(map).map(([k, v]) => [v, k])) as Record<V, K>;
}

const STATUS_TO_API = invert(STATUS_FROM_API) as Record<string, TaskStatusDto>;
const PRIORITY_TO_API = invert(PRIORITY_FROM_API);
const COMPLEXITY_TO_API = invert(COMPLEXITY_FROM_API);

/** Status padrão são traduzidos; chaves de colunas personalizadas passam intactas. */
export function statusFromApi(status: string): TaskStatus {
  return STATUS_FROM_API[status as TaskStatusDto] ?? status;
}

export function statusToApi(status: TaskStatus): string {
  return STATUS_TO_API[status] ?? status;
}

export function toTask(dto: TaskResponseDto): Task {
  return {
    id: dto.id,
    title: dto.titulo,
    content: dto.conteudo ?? null,
    requirements: dto.requisitos ?? null,
    technologies: dto.tecnologias ?? [],
    status: statusFromApi(dto.status),
    priority: PRIORITY_FROM_API[dto.prioridade] ?? "MEDIUM",
    complexity: dto.complexidade ? (COMPLEXITY_FROM_API[dto.complexidade] ?? null) : null,
    dueDate: dto.prazo ? dto.prazo.slice(0, 10) : null,
    assigneeId: dto.responsavelId ?? dto.responsavel?.id ?? null,
    dependencyIds: dto.dependenciasIds ?? [],
    projectId: dto.projetoId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function toTaskRequest(input: TaskInput): TaskRequestDto {
  return {
    titulo: input.title,
    conteudo: input.content,
    requisitos: input.requirements,
    tecnologias: input.technologies,
    status: statusToApi(input.status),
    prioridade: PRIORITY_TO_API[input.priority],
    complexidade:
      input.complexity === undefined
        ? undefined
        : input.complexity && COMPLEXITY_TO_API[input.complexity],
    prazo: input.dueDate,
    responsavelId: input.assigneeId,
    dependenciasIds: input.dependencyIds,
    projetoId: input.projectId,
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
    ...overrides,
  };
}

export function toColumn(dto: ColumnDto, index: number): BoardColumn {
  const status = statusFromApi(dto.status);
  return {
    id: dto.id,
    name: dto.nome,
    status,
    order: dto.ordem ?? index,
    custom: !TASK_STATUSES.some((s) => s.value === status),
  };
}

export const DEFAULT_COLUMNS: BoardColumn[] = TASK_STATUSES.map((status, index) => ({
  id: null,
  name: status.label,
  status: status.value,
  order: index,
  custom: false,
}));

function toAuthor(dto?: AuthorDto | null): TaskAuthor | null {
  if (!dto?.username) return null;
  return { id: dto.id ?? null, username: dto.username };
}

export function toComment(dto: CommentDto): TaskComment {
  return {
    id: dto.id,
    content: dto.conteudo,
    author: toAuthor(dto.autor),
    createdAt: dto.createdAt,
  };
}

export function toAttachment(dto: AttachmentDto): TaskAttachment {
  return {
    id: dto.id,
    fileName: dto.nomeArquivo,
    contentType: dto.tipoConteudo ?? null,
    size: dto.tamanho ?? null,
    uploadedBy: toAuthor(dto.autor),
    createdAt: dto.createdAt,
  };
}

export function toHistoryEntry(dto: HistoryDto): TaskHistoryEntry {
  return {
    id: dto.id,
    field: dto.campo ?? null,
    oldValue: dto.valorAnterior ?? null,
    newValue: dto.valorNovo ?? null,
    description: dto.descricao ?? null,
    author: toAuthor(dto.autor),
    createdAt: dto.createdAt,
  };
}
