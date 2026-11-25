/** Documento indexado em um projeto (`Documento` do backend). */
export interface KnowledgeDocument {
  id: number;
  fileName: string;
  /** Tipo informado pelo backend (ex.: PDF, MARKDOWN, TEXTO). */
  type: string | null;
  chunks: number;
  createdAt?: string;
}

/** Trecho de um documento, como a IA o recupera. */
export interface DocumentChunk {
  ref: string;
  page: number | null;
  excerpt: string;
}

/** Configuração de domínio da IA: dois textos livres de até 4000 caracteres. */
export interface DomainSettings {
  rules: string;
  vocabulary: string;
}

export interface DocumentDto {
  id: number;
  nome: string;
  tipo?: string | null;
  trechos?: number | null;
  criadoEm?: string;
}

export interface ChunkDto {
  id: string;
  pagina?: number | null;
  trecho?: string | null;
}

export interface DomainDto {
  regras: string;
  vocabulario: string;
}
