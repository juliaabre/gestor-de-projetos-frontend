
export type DefaultTaskStatus = "TODO" | "IN_PROGRESS" | "DONE" | "CANCELLED";
export type TaskStatus = DefaultTaskStatus | (string & {});

export type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

/** Escala de complexidade do backend: 1 (muito baixa) a 5 (muito alta). */
export type TaskComplexity = 1 | 2 | 3 | 4 | 5;

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
  { value: 1, label: "Muito baixa" },
  { value: 2, label: "Baixa" },
  { value: 3, label: "Média" },
  { value: 4, label: "Alta" },
  { value: 5, label: "Muito alta" },
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

/** O backend informa só o id do autor; o nome vem da equipe do projeto. */
export interface TaskAuthor {
  id: number | null;
  username: string | null;
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

/** Ações registradas pelo backend: CRIACAO, ATUALIZACAO, STATUS, ATRIBUICAO etc. */
export interface TaskHistoryEntry {
  id: number;
  action: string;
  actorId: number | null;
  assigneeId: number | null;
  status: TaskStatus | null;
  createdAt?: string;
}

// ---- Contrato do backend ----

export type TaskStatusDto =
  | "PENDENTE"
  | "EM_ANDAMENTO"
  | "CONCLUIDA"
  | "CANCELADA";

export type TaskPriorityDto = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export interface TaskRequestDto {
  titulo: string;
  conteudo?: string;
  requisitos?: string;
  tecnologias?: string[];
  status: string;
  prioridade: TaskPriorityDto;
  complexidade?: number | null;
  prazo?: string | null;
  responsavelId?: number | null;
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
  complexidade?: number | null;
  prazo?: string | null;
  responsavelId?: number | null;
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

export interface CommentDto {
  id: number;
  autorId?: number | null;
  texto: string;
  criadoEm?: string;
}

export interface AttachmentDto {
  id: number;
  autorId?: number | null;
  nome: string;
  tamanho?: number | null;
  criadoEm?: string;
}

export interface HistoryDto {
  id: number;
  acao: string;
  atorId?: number | null;
  responsavelId?: number | null;
  status?: string | null;
  criadoEm?: string;
}

/** Pré-requisito registrado em `/api/tarefas/{id}/dependencias`. */
export interface PrerequisiteDto {
  id: number;
  titulo: string;
}
