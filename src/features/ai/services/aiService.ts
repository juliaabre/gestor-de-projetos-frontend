import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import {
  DECISION_TO_API,
  toAiAnswer,
  toAssistantAnswer,
  toDependencySuggestions,
  toRecommendationResult,
} from "../mappers";
import type {
  AiAnswer,
  AnswerDto,
  AssistantAnswer,
  DecisionInput,
  DependencySuggestionResult,
  RecommendationDto,
  RecommendationResult,
  SummaryPeriod,
} from "../types";

/** Chamadas de IA podem demorar mais que o CRUD; acima disso a IA é tratada como indisponível. */
const AI_TIMEOUT = 60_000;

/** Gera uma nova recomendação de responsáveis (exige gerente do projeto). */
export async function recommendAssignees(taskId: number): Promise<RecommendationResult> {
  const { data } = await api.post<RecommendationDto>(endpoints.ai.recommendations(taskId), null, {
    timeout: AI_TIMEOUT,
  });
  return toRecommendationResult(data);
}

/**
 * Registra a decisão. Em ACEITA o backend atribui o primeiro do ranking; em
 * AJUSTADA, o integrante informado; em RECUSADA, ninguém.
 */
export async function registerDecision(input: DecisionInput): Promise<RecommendationResult> {
  const { data } = await api.post<RecommendationDto>(
    endpoints.ai.recommendationFeedback(input.taskId, input.recommendationId),
    {
      decisao: DECISION_TO_API[input.decision],
      usuarioId: input.decision === "ADJUSTED" ? input.chosenUserId : undefined,
      observacao: input.note || undefined,
    },
  );
  return toRecommendationResult(data);
}

/** Consulta em linguagem natural (qualquer integrante do projeto). */
export async function askAssistant(
  projectId: number,
  question: string,
  signal?: AbortSignal,
): Promise<AssistantAnswer> {
  const { data } = await api.post<AnswerDto>(
    endpoints.ai.query,
    { pergunta: question },
    { params: { projetoId: projectId }, timeout: AI_TIMEOUT, signal },
  );
  return toAssistantAnswer(data, question);
}

export async function getSummary(projectId: number, period: SummaryPeriod = {}): Promise<AiAnswer> {
  const { data } = await api.get<AnswerDto>(endpoints.ai.summary(projectId), {
    params: { inicio: period.start || undefined, fim: period.end || undefined },
    timeout: AI_TIMEOUT,
  });
  return toAiAnswer(data);
}

export async function getBottlenecks(projectId: number): Promise<AiAnswer> {
  const { data } = await api.get<AnswerDto>(endpoints.ai.bottlenecks(projectId), {
    timeout: AI_TIMEOUT,
  });
  return toAiAnswer(data);
}

/** Gera ou refina a descrição de uma tarefa já salva, conforme a instrução. */
export async function generateDescription(taskId: number, instruction: string): Promise<AiAnswer> {
  const { data } = await api.post<AnswerDto>(
    endpoints.ai.description(taskId),
    { pergunta: instruction },
    { timeout: AI_TIMEOUT },
  );
  return toAiAnswer(data);
}

export async function suggestDependencies(taskId: number): Promise<DependencySuggestionResult> {
  const { data } = await api.get<AnswerDto>(endpoints.ai.dependencies(taskId), {
    timeout: AI_TIMEOUT,
  });
  const answer = toAiAnswer(data);
  return { answer, suggestions: toDependencySuggestions(answer, taskId) };
}
