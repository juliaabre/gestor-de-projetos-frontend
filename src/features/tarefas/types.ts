/** enum StatusTarefa do backend — define as colunas do quadro Kanban. */
export type StatusTarefa = "PENDENTE" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";

/** enum PrioridadeTarefa do backend */
export type PrioridadeTarefa = "BAIXA" | "MEDIA" | "ALTA" | "URGENTE";

export const STATUS_TAREFA: readonly { value: StatusTarefa; label: string }[] = [
  { value: "PENDENTE", label: "A fazer" },
  { value: "EM_ANDAMENTO", label: "Em andamento" },
  { value: "CONCLUIDA", label: "Concluído" },
  { value: "CANCELADA", label: "Cancelado" },
];

export const PRIORIDADE_TAREFA: readonly { value: PrioridadeTarefa; label: string }[] = [
  { value: "BAIXA", label: "Baixa" },
  { value: "MEDIA", label: "Média" },
  { value: "ALTA", label: "Alta" },
  { value: "URGENTE", label: "Urgente" },
];

/** TarefaRequestDTO — todos obrigatórios, exceto `conteudo`. */
export interface TarefaRequest {
  titulo: string;
  conteudo?: string;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  projetoId: number;
}

/** TarefaResponseDTO */
export interface Tarefa {
  id: number;
  titulo: string;
  conteudo?: string | null;
  status: StatusTarefa;
  prioridade: PrioridadeTarefa;
  projetoId: number;
  createdAt?: string;
  updatedAt?: string;
}
