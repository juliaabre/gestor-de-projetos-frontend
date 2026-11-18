import type {
  Task,
  TaskInput,
  TaskPriority,
  TaskPriorityDto,
  TaskRequestDto,
  TaskResponseDto,
  TaskStatus,
  TaskStatusDto,
} from "./types";

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

const STATUS_TO_API = invert(STATUS_FROM_API);
const PRIORITY_TO_API = invert(PRIORITY_FROM_API);

export function toTask(dto: TaskResponseDto): Task {
  return {
    id: dto.id,
    title: dto.titulo,
    content: dto.conteudo ?? null,
    status: STATUS_FROM_API[dto.status],
    priority: PRIORITY_FROM_API[dto.prioridade],
    projectId: dto.projetoId,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
  };
}

export function toTaskRequest(input: TaskInput): TaskRequestDto {
  return {
    titulo: input.title,
    conteudo: input.content,
    status: STATUS_TO_API[input.status],
    prioridade: PRIORITY_TO_API[input.priority],
    projetoId: input.projectId,
  };
}
