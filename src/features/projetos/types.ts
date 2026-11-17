/** ProjetoRequestDTO */
export interface ProjetoRequest {
  nome: string;
  /**
   * Aceito pelo DTO, mas a entidade Projeto ainda não tem esse campo,
   * então hoje o backend descarta o valor.
   */
  descricao?: string;
}

/** ProjetoResponseDTO */
export interface Projeto {
  id: number;
  nome: string;
  equipeIds?: number[] | null;
  tarefasIds?: number[] | null;
  createdAt?: string;
}
