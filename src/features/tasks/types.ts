export type TaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export const TASK_STATUSES: readonly { value: TaskStatus; label: string }[] = [
  { value: "TODO", label: "A fazer" },
  { value: "IN_PROGRESS", label: "Em andamento" },
  { value: "DONE", label: "Concluído" },
  { value: "CANCELLED", label: "Cancelado" },
];

export const TASK_PRIORITIES: readonly {
  value: TaskPriority;
  label: string;
}[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
];

export interface Task {
  id: number;
  title: string;
  content: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskInput {
  title: string;
  content?: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId: number;
}

export type TaskStatusDto =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA";

export type TaskPriorityDto = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export interface TaskRequestDto {
  titulo: string;
  conteudo?: string;
  status: TaskStatusDto;
  prioridade: TaskPriorityDto;
  projetoId: number;
}

export interface TaskResponseDto {
  id: number;
  titulo: string;
  conteudo?: string | null;
  status: TaskStatusDto;
  prioridade: TaskPriorityDto;
  projetoId: number;
  createdAt?: string;
  updatedAt?: string;
}
