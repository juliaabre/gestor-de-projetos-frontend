import type {
  AiSource,
  AssistantAnswer,
  Bottleneck,
  BottleneckDto,
  BottleneckKind,
  DependencySuggestion,
  DependencySuggestionDto,
  DescriptionResponseDto,
  DescriptionSuggestion,
  QueryResponseDto,
  Recommendation,
  RecommendationDecision,
  RecommendationDto,
  RecommendationResponseDto,
  RecommendationResult,
  Severity,
  SourceDto,
  SourceType,
  SummaryResponseDto,
  ProjectSummary,
} from "./types";

const SOURCE_TYPES: Record<string, SourceType> = {
  TAREFA: "TASK",
  DOCUMENTO: "DOCUMENT",
  PROJETO: "PROJECT",
};

const BOTTLENECK_KINDS: Record<string, BottleneckKind> = {
  TAREFA_PARADA: "STALLED_TASK",
  MEMBRO_SOBRECARREGADO: "OVERLOADED_MEMBER",
  DEPENDENCIA_BLOQUEANTE: "BLOCKING_DEPENDENCY",
};

const SEVERITIES: Record<string, Severity> = { BAIXA: "LOW", MEDIA: "MEDIUM", ALTA: "HIGH" };

export const DECISION_TO_API: Record<RecommendationDecision, string> = {
  ACCEPTED: "ACEITA",
  ADJUSTED: "AJUSTADA",
  REJECTED: "RECUSADA",
};

/** Aceita adequação em fração (0–1) ou em percentual (0–100). */
export function toPercent(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0;
  const percent = value <= 1 ? value * 100 : value;
  return Math.round(Math.min(100, Math.max(0, percent)));
}

export function toSource(dto: SourceDto): AiSource {
  const type = SOURCE_TYPES[(dto.tipo ?? "").toUpperCase()] ?? "OTHER";
  return {
    type,
    id: dto.id ?? null,
    title: dto.titulo ?? dto.nome ?? (dto.id != null ? `#${dto.id}` : "Fonte"),
    excerpt: dto.trecho ?? null,
  };
}

const sources = (list?: SourceDto[] | null) => (list ?? []).map(toSource);

export function toBottleneck(dto: BottleneckDto): Bottleneck {
  return {
    kind: BOTTLENECK_KINDS[(dto.tipo ?? "").toUpperCase()] ?? "OTHER",
    severity: SEVERITIES[(dto.severidade ?? "").toUpperCase()] ?? "MEDIUM",
    description: dto.descricao,
    tasks: (dto.tarefas ?? []).map((t) => ({ id: t.id, title: t.titulo })),
    members: dto.usuarios ?? [],
  };
}

export function toRecommendation(dto: RecommendationDto): Recommendation {
  return {
    userId: dto.usuarioId,
    username: dto.username ?? dto.nome ?? `#${dto.usuarioId}`,
    score: toPercent(dto.adequacao),
    justification: dto.justificativa ?? "",
    skills: dto.competencias ?? [],
    currentLoad: dto.cargaAtual ?? null,
    sources: sources(dto.fontes),
  };
}

export function toRecommendationResult(
  dto: RecommendationResponseDto | RecommendationDto[],
): RecommendationResult {
  const body = Array.isArray(dto) ? { recomendacoes: dto } : dto;
  return {
    recommendationId: body.recomendacaoId ?? null,
    fallback: (body.modo ?? "").toUpperCase() === "PONTUACAO_SIMPLES",
    items: (body.recomendacoes ?? []).map(toRecommendation).sort((a, b) => b.score - a.score),
  };
}

export function toAnswer(dto: QueryResponseDto, question: string): AssistantAnswer {
  return {
    id: dto.id != null ? String(dto.id) : `${Date.now()}-${Math.random()}`,
    question: dto.pergunta ?? question,
    answer: dto.resposta,
    sources: sources(dto.fontes),
    bottlenecks: (dto.gargalos ?? []).map(toBottleneck),
    createdAt: dto.createdAt,
  };
}

export function toSummary(dto: SummaryResponseDto): ProjectSummary {
  return {
    summary: dto.resumo,
    generatedAt: dto.geradoEm ?? undefined,
    sources: sources(dto.fontes),
  };
}

export function toDescriptionSuggestion(dto: DescriptionResponseDto): DescriptionSuggestion {
  return {
    description: dto.descricao,
    justification: dto.justificativa ?? null,
    sources: sources(dto.fontes),
  };
}

export function toDependencySuggestion(dto: DependencySuggestionDto): DependencySuggestion {
  return {
    taskId: dto.tarefaId,
    title: dto.titulo ?? null,
    justification: dto.justificativa ?? "",
    confidence: dto.confianca != null ? toPercent(dto.confianca) : null,
  };
}
