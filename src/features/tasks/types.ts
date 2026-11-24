
export type DefaultTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type TaskStatus = DefaultTaskStatus | (string & {});

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type TaskComplexity = "LOW" | "MEDIUM" | "HIGH";

export const TASK_STATUSES: readonly { value: DefaultTaskStatus; label: string }[] = [
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

export const TASK_COMPLEXITIES: readonly {
  value: TaskComplexity;
  label: string;
}[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
];

export interface Task {
  id: number;
  title: string;
  content: string | null;
  requirements: string | null;
  technologies: string[];
  status: TaskStatus;
  priority: TaskPriority;
  complexity: TaskComplexity | null;
  dueDate: string | null;
  assigneeId: number | null;
  dependencyIds: number[];
  projectId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface TaskInput {
  title: string;
  content?: string;
  requirements?: string;
  technologies?: string[];
  status: TaskStatus;
  priority: TaskPriority;
  complexity?: TaskComplexity | null;
  dueDate?: string | null;
  assigneeId?: number | null;
  dependencyIds?: number[];
  projectId: number;
}

export interface BoardColumn {
  id: number | null;
  name: string;
  status: TaskStatus;
  order: number;
  custom: boolean;
}

export interface ColumnInput {
  name: string;
  status?: TaskStatus;
}

export interface TaskAuthor {
  id: number | null;
  username: string;
}

export interface TaskComment {
  id: number;
  content: string;
  author: TaskAuthor | null;
  createdAt?: string;
}

export interface TaskAttachment {
  id: number;
  fileName: string;
  contentType: string | null;
  size: number | null;
  uploadedBy: TaskAuthor | null;
  createdAt?: string;
}

export interface TaskHistoryEntry {
  id: number;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  description: string | null;
  author: TaskAuthor | null;
  createdAt?: string;
}

// ---- Contrato do backend ----

export type TaskStatusDto =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA";

export type TaskPriorityDto = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export type TaskComplexityDto = "BAIXA" | "MEDIA" | "ALTA";

export interface TaskRequestDto {
  titulo: string;
  conteudo?: string;
  requisitos?: string;
  tecnologias?: string[];
  status: string;
  prioridade: TaskPriorityDto;
  complexidade?: TaskComplexityDto | null;
  prazo?: string | null;
  responsavelId?: number | null;
  dependenciasIds?: number[];
  projetoId: number;
}

export interface TaskResponseDto {
  id: number;
  titulo: string;
  conteudo?: string | null;
  requisitos?: string | null;
  tecnologias?: string[] | null;
  status: string;
  prioridade: TaskPriorityDto;
  complexidade?: TaskComplexityDto | null;
  prazo?: string | null;
  responsavelId?: number | null;
  responsavel?: { id: number } | null;
  dependenciasIds?: number[] | null;
  projetoId: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface ColumnDto {
  id: number;
  nome: string;
  status: string;
  ordem?: number | null;
}

export interface AuthorDto {
  id?: number | null;
  username?: string | null;
}

export interface CommentDto {
  id: number;
  conteudo: string;
  autor?: AuthorDto | null;
  createdAt?: string;
}

export interface AttachmentDto {
  id: number;
  nomeArquivo: string;
  tipoConteudo?: string | null;
  tamanho?: number | null;
  autor?: AuthorDto | null;
  createdAt?: string;
}

export interface HistoryDto {
  id: number;
  campo?: string | null;
  valorAnterior?: string | null;
  valorNovo?: string | null;
  descricao?: string | null;
  autor?: AuthorDto | null;
  createdAt?: string;
}
