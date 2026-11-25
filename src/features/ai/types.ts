/** Tipos de fonte citados pelo backend (`Fonte.tipo`). */
export type SourceType = "TASK" | "DOCUMENT" | "PROJECT" | "INDICATORS" | "OTHER";

/** Fonte citada pela IA. `ref` é o identificador citado no texto (ex.: "T12", "D3"). */
export interface AiSource {
  ref: string;
  type: SourceType;
  /** Id do recurso original (tarefa, documento ou projeto). */
  id: number | null;
  title: string;
  excerpt: string | null;
  page: number | null;
}

/**
 * Resposta da IA (`Resposta` do backend). `fallback` indica resposta
 * alternativa, em geral extrativa, quando a síntese do modelo não está
 * disponível; `notice` traz o aviso do servidor nesses casos.
 */
export interface AiAnswer {
  text: string;
  sources: AiSource[];
  fallback: boolean;
  notice: string | null;
}

export interface Recommendation {
  userId: number;
  /** Preenchido pela tela a partir da equipe (o backend envia só o id). */
  username: string | null;
  /** Pontuação de 0 a 100. */
  score: number;
  justification: string;
  sources: AiSource[];
}

export interface RecommendationResult {
  recommendationId: number;
  /** Verdadeiro quando o contexto veio sem síntese do modelo (pontuação calculada no servidor). */
  fallback: boolean;
  notice: string | null;
  items: Recommendation[];
  /** Decisão já registrada, se houver. */
  decision: RecommendationDecision | null;
  chosenUserId: number | null;
}

export type RecommendationDecision = "ACCEPTED" | "ADJUSTED" | "REJECTED";

export interface DecisionInput {
  taskId: number;
  recommendationId: number;
  decision: RecommendationDecision;
  /** Obrigatório em ADJUSTED. */
  chosenUserId?: number | null;
  note?: string;
}

export interface AssistantAnswer extends AiAnswer {
  id: string;
  question: string;
  createdAt?: string;
}

/** Filtro opcional do resumo pelo prazo das tarefas (datas AAAA-MM-DD). */
export interface SummaryPeriod {
  start?: string;
  end?: string;
}

/** Tarefa citada pela IA ao sugerir dependências, para revisão antes de registrar. */
export interface DependencySuggestion {
  taskId: number;
  title: string;
  justification: string;
  /** Similaridade da fonte, de 0 a 100. */
  confidence: number | null;
}

export interface DependencySuggestionResult {
  answer: AiAnswer;
  suggestions: DependencySuggestion[];
}

// ---- Contrato do backend (RagDtos) ----

export interface SourceDto {
  id: string;
  tipo?: string | null;
  recursoId?: number | null;
  titulo?: string | null;
  pagina?: number | null;
  trecho?: string | null;
  similaridade?: number | null;
}

export interface AnswerDto {
  resposta: string;
  fontes?: SourceDto[] | null;
  alternativa?: boolean | null;
  aviso?: string | null;
}

export interface CandidateDto {
  usuarioId: number;
  pontuacao: number;
  justificativa?: string | null;
  /** Identificadores das fontes citadas (ex.: "T1"), detalhadas em `contexto.fontes`. */
  fontes?: string[] | null;
}

export interface RecommendationDto {
  id: number;
  tarefaId: number;
  ranking?: CandidateDto[] | null;
  contexto?: AnswerDto | null;
  decisao?: string | null;
  escolhidoId?: number | null;
}
