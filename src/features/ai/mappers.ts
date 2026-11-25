import type {
  AiAnswer,
  AiSource,
  AnswerDto,
  AssistantAnswer,
  DependencySuggestion,
  Recommendation,
  RecommendationDecision,
  RecommendationDto,
  RecommendationResult,
  SourceDto,
  SourceType,
} from "./types";

const SOURCE_TYPES: Record<string, SourceType> = {
  TAREFA: "TASK",
  DOCUMENTO: "DOCUMENT",
  PROJETO: "PROJECT",
  INDICADORES: "INDICATORS",
};

export const DECISION_TO_API: Record<RecommendationDecision, string> = {
  ACCEPTED: "ACEITA",
  ADJUSTED: "AJUSTADA",
  REJECTED: "RECUSADA",
};

const DECISION_FROM_API: Record<string, RecommendationDecision> = {
  ACEITA: "ACCEPTED",
  AJUSTADA: "ADJUSTED",
  RECUSADA: "REJECTED",
};

/** Aceita valores em fração (0–1) ou em percentual (0–100). */
export function toPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const percent = value <= 1 ? value * 100 : value;
  return Math.round(Math.min(100, Math.max(0, percent)));
}

export function toSource(dto: SourceDto): AiSource {
  return {
    ref: dto.id,
    type: SOURCE_TYPES[(dto.tipo ?? "").toUpperCase()] ?? "OTHER",
    id: dto.recursoId ?? null,
    title: dto.titulo || dto.id,
    excerpt: dto.trecho ?? null,
    page: dto.pagina ?? null,
  };
}

export function toAiAnswer(dto: AnswerDto): AiAnswer {
  return {
    text: dto.resposta ?? "",
    sources: (dto.fontes ?? []).map(toSource),
    fallback: Boolean(dto.alternativa),
    notice: dto.aviso ?? null,
  };
}

export function toAssistantAnswer(dto: AnswerDto, question: string): AssistantAnswer {
  return {
    ...toAiAnswer(dto),
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    question,
    createdAt: new Date().toISOString(),
  };
}

export function toRecommendationResult(dto: RecommendationDto): RecommendationResult {
  const context = dto.contexto ? toAiAnswer(dto.contexto) : null;
  const byRef = new Map((context?.sources ?? []).map((source) => [source.ref, source]));
  const items: Recommendation[] = (dto.ranking ?? [])
    .map((candidate) => ({
      userId: candidate.usuarioId,
      username: null,
      score: toPercent(candidate.pontuacao),
      justification: candidate.justificativa ?? "",
      sources: (candidate.fontes ?? [])
        .map((ref) => byRef.get(ref))
        .filter((source): source is AiSource => Boolean(source)),
    }))
    .sort((a, b) => b.score - a.score);
  return {
    recommendationId: dto.id,
    fallback: context?.fallback ?? false,
    notice: context?.notice ?? null,
    items,
    decision: dto.decisao ? (DECISION_FROM_API[dto.decisao.toUpperCase()] ?? null) : null,
    chosenUserId: dto.escolhidoId ?? null,
  };
}

/**
 * O backend responde à sugestão de dependências com texto e fontes. As
 * tarefas citadas (exceto a própria) viram candidatas para revisão.
 */
export function toDependencySuggestions(answer: AiAnswer, taskId: number): DependencySuggestion[] {
  const seen = new Set<number>();
  return answer.sources
    .filter((source) => source.type === "TASK" && source.id != null && source.id !== taskId)
    .filter((source) => !seen.has(source.id!) && Boolean(seen.add(source.id!)))
    .map((source) => ({
      taskId: source.id!,
      title: source.title,
      justification: source.excerpt ?? "",
      confidence: null,
    }));
}
