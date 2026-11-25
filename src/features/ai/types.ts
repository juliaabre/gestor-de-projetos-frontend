export type SourceType = "TASK" | "DOCUMENT" | "PROJECT" | "OTHER";

/** Fonte citada pela IA. */
export interface AiSource {
  type: SourceType;
  id: number | null;
  title: string;
  excerpt: string | null;
}

export type BottleneckKind = "STALLED_TASK" | "OVERLOADED_MEMBER" | "BLOCKING_DEPENDENCY" | "OTHER";
export type Severity = "LOW" | "MEDIUM" | "HIGH";

export interface Bottleneck {
  kind: BottleneckKind;
  severity: Severity;
  description: string;
  tasks: { id: number; title: string }[];
  members: { id: number; username: string }[];
}

export interface Recommendation {
  userId: number;
  username: string;
  /** Percentual de adequação, de 0 a 100. */
  score: number;
  justification: string;
  skills: string[];
  currentLoad: number | null;
  sources: AiSource[];
}

export interface RecommendationResult {
  recommendationId: number | null;
  /** Verdadeiro quando o backend usou a alocação alternativa por pontuação simples (sem LLM). */
  fallback: boolean;
  items: Recommendation[];
}

export type RecommendationDecision = "ACCEPTED" | "ADJUSTED" | "REJECTED";

export interface DecisionInput {
  taskId: number;
  recommendationId: number | null;
  decision: RecommendationDecision;
  recommendedUserId: number | null;
  chosenUserId: number | null;
  reason?: string;
}

export interface AssistantAnswer {
  id: string;
  question: string;
  answer: string;
  sources: AiSource[];
  bottlenecks: Bottleneck[];
  createdAt?: string;
}

export interface ProjectSummary {
  summary: string;
  generatedAt?: string;
  sources: AiSource[];
}

export type SummaryScope = "PROJECT" | "SPRINT";

export interface DescriptionSuggestion {
  description: string;
  justification: string | null;
  sources: AiSource[];
}

export interface DependencySuggestion {
  taskId: number;
  title: string | null;
  justification: string;
  confidence: number | null;
}

// ---- Contrato do backend ----

export interface SourceDto {
  tipo?: string | null;
  id?: number | null;
  titulo?: string | null;
  nome?: string | null;
  trecho?: string | null;
}

export interface BottleneckDto {
  tipo?: string | null;
  severidade?: string | null;
  descricao: string;
  tarefas?: { id: number; titulo: string }[] | null;
  usuarios?: { id: number; username: string }[] | null;
}

export interface RecommendationDto {
  usuarioId: number;
  username?: string | null;
  nome?: string | null;
  adequacao: number;
  justificativa?: string | null;
  competencias?: string[] | null;
  cargaAtual?: number | null;
  fontes?: SourceDto[] | null;
}

export interface RecommendationResponseDto {
  recomendacaoId?: number | null;
  modo?: string | null;
  recomendacoes?: RecommendationDto[] | null;
}

export interface QueryResponseDto {
  resposta: string;
  fontes?: SourceDto[] | null;
  gargalos?: BottleneckDto[] | null;
  id?: number | string | null;
  pergunta?: string | null;
  createdAt?: string;
}

export interface SummaryResponseDto {
  resumo: string;
  geradoEm?: string | null;
  fontes?: SourceDto[] | null;
}

export interface DescriptionResponseDto {
  descricao: string;
  justificativa?: string | null;
  fontes?: SourceDto[] | null;
}

export interface DependencySuggestionDto {
  tarefaId: number;
  titulo?: string | null;
  justificativa?: string | null;
  confianca?: number | null;
}
