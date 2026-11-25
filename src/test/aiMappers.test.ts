import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import { getAiErrorKind } from "@/lib/apiError";
import {
  toAiAnswer,
  toAssistantAnswer,
  toDependencySuggestions,
  toPercent,
  toRecommendationResult,
} from "@/features/ai/mappers";
import { toDocument } from "@/features/admin/services/knowledgeService";
import { apiError } from "./fixtures";
import * as sample from "./backendSamples";

describe("contrato da IA com o backend", () => {
  it("converte a Resposta com fontes, aviso e modo alternativo", () => {
    const answer = toAiAnswer(sample.fallbackAnswer);
    expect(answer.fallback).toBe(true);
    expect(answer.notice).toMatch(/extrativa/);
    expect(answer.sources.map((s) => [s.ref, s.type, s.id])).toEqual([
      ["P1", "PROJECT", 1],
      ["T2", "TASK", 2],
      ["G1", "INDICATORS", 1],
    ]);
    expect(toAssistantAnswer(sample.fallbackAnswer, "Pergunta").question).toBe("Pergunta");
  });

  it("ordena o ranking pela pontuação (0–100) e liga as fontes citadas", () => {
    expect(toPercent(0.92)).toBe(92);
    expect(toPercent(33)).toBe(33);
    expect(toPercent(150)).toBe(100);
    const result = toRecommendationResult(sample.recommendation);
    expect(result.recommendationId).toBe(1);
    expect(result.fallback).toBe(true);
    expect(result.items.map((i) => [i.userId, i.score])).toEqual([[3, 33], [2, 25]]);
    expect(result.items[0].sources.map((s) => s.ref)).toEqual(["T1", "P1"]);
    expect(result.decision).toBeNull();
    expect(toRecommendationResult({ ...sample.recommendation, decisao: "AJUSTADA", escolhidoId: 3 })).toMatchObject({
      decision: "ADJUSTED",
      chosenUserId: 3,
    });
  });

  it("transforma as tarefas citadas em sugestões de dependência, sem a própria tarefa", () => {
    const answer = toAiAnswer({
      ...sample.fallbackAnswer,
      fontes: [
        { id: "T2", tipo: "TAREFA", recursoId: 2, titulo: "Própria", trecho: "", similaridade: 1 },
        { id: "T1", tipo: "TAREFA", recursoId: 1, titulo: "API login", trecho: "Tarefa 1", similaridade: 1 },
        { id: "T1b", tipo: "TAREFA", recursoId: 1, titulo: "API login", trecho: "repetida", similaridade: 1 },
        { id: "P1", tipo: "PROJETO", recursoId: 1, titulo: "Aurora", trecho: "", similaridade: 1 },
      ],
    });
    expect(toDependencySuggestions(answer, 2)).toEqual([
      { taskId: 1, title: "API login", justification: "Tarefa 1", confidence: null },
    ]);
  });

  it("converte documentos indexados", () => {
    expect(toDocument(sample.documentItem)).toEqual({
      id: 7, fileName: "regras.md", type: "MARKDOWN", chunks: 3, createdAt: "2026-11-25T21:50:14Z",
    });
  });

  it("classifica indisponibilidade da IA", () => {
    expect(getAiErrorKind(apiError(503))).toBe("unavailable");
    expect(getAiErrorKind(apiError(404))).toBe("unavailable");
    expect(getAiErrorKind(new AxiosError("timeout", "ECONNABORTED"))).toBe("unavailable");
    expect(getAiErrorKind(apiError(403))).toBe("error");
    expect(getAiErrorKind(apiError(500))).toBe("error");
  });
});
