import { describe, expect, it } from "vitest";
import { AxiosError } from "axios";
import { getAiErrorKind } from "@/lib/apiError";
import { toAnswer, toPercent, toRecommendationResult } from "@/features/ai/mappers";
import { toDocument } from "@/features/admin/services/knowledgeService";
import { apiError } from "./fixtures";

describe("mapeadores da IA", () => {
  it("normaliza adequação em fração ou percentual e ordena o ranking", () => {
    expect(toPercent(0.92)).toBe(92);
    expect(toPercent(78)).toBe(78);
    expect(toPercent(150)).toBe(100);
    const result = toRecommendationResult({
      recomendacaoId: 3,
      modo: "PONTUACAO_SIMPLES",
      recomendacoes: [
        { usuarioId: 1, username: "a", adequacao: 0.5 },
        { usuarioId: 2, username: "b", adequacao: 0.9, competencias: ["Java"], cargaAtual: 2 },
      ],
    });
    expect(result.fallback).toBe(true);
    expect(result.items.map((i) => [i.userId, i.score])).toEqual([[2, 90], [1, 50]]);
    expect(toRecommendationResult([{ usuarioId: 1, adequacao: 10 }]).recommendationId).toBeNull();
  });

  it("converte resposta do assistente com fontes e gargalos", () => {
    const answer = toAnswer(
      {
        resposta: "Ok",
        fontes: [{ tipo: "TAREFA", id: 12, titulo: "Login" }, { tipo: "DOCUMENTO", nome: "Guia.pdf" }],
        gargalos: [{ tipo: "MEMBRO_SOBRECARREGADO", severidade: "ALTA", descricao: "x", usuarios: [{ id: 1, username: "a" }] }],
      },
      "Pergunta",
    );
    expect(answer.question).toBe("Pergunta");
    expect(answer.sources.map((s) => s.type)).toEqual(["TASK", "DOCUMENT"]);
    expect(answer.bottlenecks[0]).toMatchObject({ kind: "OVERLOADED_MEMBER", severity: "HIGH" });
  });

  it("converte o status de processamento dos documentos", () => {
    expect(toDocument({ id: 1, nomeArquivo: "a.pdf", status: "PROCESSANDO" }).status).toBe("PROCESSING");
    expect(toDocument({ id: 1, nomeArquivo: "a.pdf", status: "ERRO", mensagemErro: "PDF corrompido" })).toMatchObject({
      status: "FAILED",
      errorMessage: "PDF corrompido",
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
