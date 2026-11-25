export type DocumentStatus = "PENDING" | "PROCESSING" | "INDEXED" | "FAILED";

export interface KnowledgeDocument {
  id: number;
  fileName: string;
  contentType: string | null;
  size: number | null;
  status: DocumentStatus;
  errorMessage: string | null;
  chunks: number | null;
  projectId: number | null;
  createdAt?: string;
}

export interface DomainRule {
  id: number;
  rule: string;
  active: boolean;
  createdAt?: string;
}

export interface VocabularyTerm {
  id: number;
  term: string;
  definition: string;
  synonyms: string[];
}

export interface DocumentDto {
  id: number;
  nomeArquivo: string;
  tipoConteudo?: string | null;
  tamanho?: number | null;
  status?: string | null;
  mensagemErro?: string | null;
  quantidadeTrechos?: number | null;
  projetoId?: number | null;
  createdAt?: string;
}

export interface RuleDto {
  id: number;
  regra: string;
  ativa?: boolean | null;
  createdAt?: string;
}

export interface TermDto {
  id: number;
  termo: string;
  definicao?: string | null;
  sinonimos?: string[] | null;
}
