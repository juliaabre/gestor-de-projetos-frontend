import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import type {
  DocumentDto,
  DocumentStatus,
  DomainRule,
  KnowledgeDocument,
  RuleDto,
  TermDto,
  VocabularyTerm,
} from "../types";

const STATUS_FROM_API: Record<string, DocumentStatus> = {
  PENDENTE: "PENDING",
  PROCESSANDO: "PROCESSING",
  PROCESSADO: "INDEXED",
  INDEXADO: "INDEXED",
  CONCLUIDO: "INDEXED",
  ERRO: "FAILED",
  FALHA: "FAILED",
};

export function toDocument(dto: DocumentDto): KnowledgeDocument {
  return {
    id: dto.id,
    fileName: dto.nomeArquivo,
    contentType: dto.tipoConteudo ?? null,
    size: dto.tamanho ?? null,
    status: STATUS_FROM_API[(dto.status ?? "").toUpperCase()] ?? "PENDING",
    errorMessage: dto.mensagemErro ?? null,
    chunks: dto.quantidadeTrechos ?? null,
    projectId: dto.projetoId ?? null,
    createdAt: dto.createdAt,
  };
}

const toRule = (dto: RuleDto): DomainRule => ({
  id: dto.id,
  rule: dto.regra,
  active: dto.ativa ?? true,
  createdAt: dto.createdAt,
});

const toTerm = (dto: TermDto): VocabularyTerm => ({
  id: dto.id,
  term: dto.termo,
  definition: dto.definicao ?? "",
  synonyms: dto.sinonimos ?? [],
});

// ---- Documentos ----

export async function listDocuments(): Promise<KnowledgeDocument[]> {
  const { data } = await api.get<DocumentDto[]>(endpoints.admin.documents);
  return data.map(toDocument);
}

export async function uploadDocument(file: File, projectId: number | null): Promise<KnowledgeDocument> {
  const form = new FormData();
  form.append("arquivo", file);
  if (projectId != null) form.append("projetoId", String(projectId));
  const { data } = await api.post<DocumentDto>(endpoints.admin.documents, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return toDocument(data);
}

export async function deleteDocument(id: number): Promise<void> {
  await api.delete(endpoints.admin.documentById(id));
}

// ---- Regras de domínio ----

export async function listRules(): Promise<DomainRule[]> {
  const { data } = await api.get<RuleDto[]>(endpoints.admin.rules);
  return data.map(toRule);
}

export async function createRule(rule: string): Promise<DomainRule> {
  const { data } = await api.post<RuleDto>(endpoints.admin.rules, { regra: rule, ativa: true });
  return toRule(data);
}

export async function updateRule(id: number, input: { rule: string; active: boolean }): Promise<DomainRule> {
  const { data } = await api.put<RuleDto>(endpoints.admin.ruleById(id), {
    regra: input.rule,
    ativa: input.active,
  });
  return toRule(data);
}

export async function deleteRule(id: number): Promise<void> {
  await api.delete(endpoints.admin.ruleById(id));
}

// ---- Vocabulário ----

export interface TermInput {
  term: string;
  definition: string;
  synonyms: string[];
}

const toTermRequest = (input: TermInput) => ({
  termo: input.term,
  definicao: input.definition,
  sinonimos: input.synonyms,
});

export async function listTerms(): Promise<VocabularyTerm[]> {
  const { data } = await api.get<TermDto[]>(endpoints.admin.vocabulary);
  return data.map(toTerm);
}

export async function createTerm(input: TermInput): Promise<VocabularyTerm> {
  const { data } = await api.post<TermDto>(endpoints.admin.vocabulary, toTermRequest(input));
  return toTerm(data);
}

export async function updateTerm(id: number, input: TermInput): Promise<VocabularyTerm> {
  const { data } = await api.put<TermDto>(endpoints.admin.termById(id), toTermRequest(input));
  return toTerm(data);
}

export async function deleteTerm(id: number): Promise<void> {
  await api.delete(endpoints.admin.termById(id));
}
