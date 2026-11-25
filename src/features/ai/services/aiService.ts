import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import {
  DECISION_TO_API,
  toAnswer,
  toBottleneck,
  toDependencySuggestion,
  toDescriptionSuggestion,
  toRecommendationResult,
  toSummary,
} from "../mappers";
import type {
  AssistantAnswer,
  Bottleneck,
  BottleneckDto,
  DecisionInput,
  DependencySuggestion,
  DependencySuggestionDto,
  DescriptionResponseDto,
  DescriptionSuggestion,
  ProjectSummary,
  QueryResponseDto,
  RecommendationDto,
  RecommendationResponseDto,
  RecommendationResult,
  SummaryResponseDto,
  SummaryScope,
} from "../types";

/** Chamadas de IA podem demorar mais que o CRUD; acima disso a IA é tratada como indisponível. */
const AI_TIMEOUT = 60_000;

export async function recommendAssignees(taskId: number): Promise<RecommendationResult> {
  const { data } = await api.get<RecommendationResponseDto | RecommendationDto[]>(
    endpoints.ai.recommendAssignees,
    { params: { tarefaId: taskId }, timeout: AI_TIMEOUT },
  );
  return toRecommendationResult(data);
}

export async function registerDecision(input: DecisionInput): Promise<void> {
  await api.post(endpoints.ai.recommendationDecision, {
    tarefaId: input.taskId,
    recomendacaoId: input.recommendationId,
    decisao: DECISION_TO_API[input.decision],
    usuarioRecomendadoId: input.recommendedUserId,
    usuarioEscolhidoId: input.chosenUserId,
    motivo: input.reason || undefined,
  });
}

export async function askAssistant(
  projectId: number,
  question: string,
  signal?: AbortSignal,
): Promise<AssistantAnswer> {
  const { data } = await api.get<QueryResponseDto>(endpoints.ai.query, {
    params: { query: question, projetoId: projectId },
    timeout: AI_TIMEOUT,
    signal,
  });
  return toAnswer(data, question);
}

export async function getConversation(projectId: number): Promise<AssistantAnswer[]> {
  const { data } = await api.get<QueryResponseDto[]>(endpoints.ai.conversation, {
    params: { projetoId: projectId },
  });
  return data.map((item) => toAnswer(item, item.pergunta ?? ""));
}

export async function getSummary(
  projectId: number,
  scope: SummaryScope,
  refresh = false,
): Promise<ProjectSummary> {
  const { data } = await api.get<SummaryResponseDto>(endpoints.ai.summary, {
    params: {
      projetoId: projectId,
      escopo: scope === "SPRINT" ? "SPRINT" : "PROJETO",
      atualizar: refresh || undefined,
    },
    timeout: AI_TIMEOUT,
  });
  return toSummary(data);
}

export async function getBottlenecks(projectId: number): Promise<Bottleneck[]> {
  const { data } = await api.get<BottleneckDto[]>(endpoints.ai.bottlenecks, {
    params: { projetoId: projectId },
    timeout: AI_TIMEOUT,
  });
  return data.map(toBottleneck);
}

export async function generateDescription(input: {
  projectId: number;
  taskId?: number;
  title: string;
  currentDescription?: string;
  instruction?: string;
}): Promise<DescriptionSuggestion> {
  const { data } = await api.post<DescriptionResponseDto>(
    endpoints.ai.generateDescription,
    {
      projetoId: input.projectId,
      tarefaId: input.taskId,
      titulo: input.title,
      descricaoAtual: input.currentDescription || undefined,
      instrucao: input.instruction || undefined,
    },
    { timeout: AI_TIMEOUT },
  );
  return toDescriptionSuggestion(data);
}

export async function suggestDependencies(taskId: number): Promise<DependencySuggestion[]> {
  const { data } = await api.get<DependencySuggestionDto[]>(endpoints.ai.suggestDependencies, {
    params: { tarefaId: taskId },
    timeout: AI_TIMEOUT,
  });
  return data.map(toDependencySuggestion);
}
