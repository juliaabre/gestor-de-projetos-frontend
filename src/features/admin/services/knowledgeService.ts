import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import type {
  ChunkDto,
  DocumentChunk,
  DocumentDto,
  DomainDto,
  DomainSettings,
  KnowledgeDocument,
} from "../types";

export function toDocument(dto: DocumentDto): KnowledgeDocument {
  return {
    id: dto.id,
    fileName: dto.nome,
    type: dto.tipo ?? null,
    chunks: dto.trechos ?? 0,
    createdAt: dto.criadoEm,
  };
}

// ---- Documentos (por projeto) ----

export async function listDocuments(projectId: number): Promise<KnowledgeDocument[]> {
  const { data } = await api.get<DocumentDto[]>(endpoints.projects.documents(projectId));
  return data.map(toDocument);
}

/**
 * A indexação acontece na própria requisição: o documento volta já indexado.
 * Erros comuns: 413 (grande demais), 415 (formato), 422 (PDF sem texto) e
 * 503 (provedor de embeddings desligado).
 */
export async function uploadDocument(projectId: number, file: File): Promise<KnowledgeDocument> {
  const form = new FormData();
  form.append("arquivo", file);
  const { data } = await api.post<DocumentDto>(endpoints.admin.projectDocuments(projectId), form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120_000,
  });
  return toDocument(data);
}

export async function deleteDocument(projectId: number, documentId: number): Promise<void> {
  await api.delete(endpoints.admin.projectDocument(projectId, documentId));
}

export async function listChunks(projectId: number, documentId: number): Promise<DocumentChunk[]> {
  const { data } = await api.get<ChunkDto[]>(endpoints.projects.documentChunks(projectId, documentId));
  return data.map((chunk) => ({ ref: chunk.id, page: chunk.pagina ?? null, excerpt: chunk.trecho ?? "" }));
}

// ---- Regras de domínio e vocabulário ----

export async function getDomain(): Promise<DomainSettings> {
  const { data } = await api.get<DomainDto>(endpoints.admin.domain);
  return { rules: data.regras ?? "", vocabulary: data.vocabulario ?? "" };
}

export async function saveDomain(input: DomainSettings): Promise<DomainSettings> {
  const { data } = await api.post<DomainDto>(endpoints.admin.domain, {
    regras: input.rules,
    vocabulario: input.vocabulary,
  });
  return { rules: data.regras ?? "", vocabulary: data.vocabulario ?? "" };
}
