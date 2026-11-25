/**
 * Rotas do backend (branch `feat/gerencia-por-projeto`). Referência completa:
 * `src/docs/MANUAL_API.md` no repositório do backend.
 */
export const endpoints = {
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/auth/register",
  },
  users: {
    base: "/api/usuarios",
    byId: (id: number) => `/api/usuarios/${id}`,
    skills: (userId: number) => `/api/usuarios/${userId}/competencias`,
  },
  projects: {
    base: "/api/projetos",
    byId: (id: number) => `/api/projetos/${id}`,
    archive: (id: number) => `/api/projetos/${id}/arquivar`,
    unarchive: (id: number) => `/api/projetos/${id}/desarquivar`,
    team: (id: number) => `/api/projetos/${id}/equipe`,
    teamMembers: (id: number) => `/api/projetos/${id}/equipe/membros`,
    teamMember: (id: number, userId: number) => `/api/projetos/${id}/equipe/membros/${userId}`,
    documents: (id: number) => `/api/projetos/${id}/documentos`,
    documentChunks: (id: number, documentId: number) =>
      `/api/projetos/${id}/documentos/${documentId}/trechos`,
    /**
     * Colunas personalizadas: proposta ainda não implementada no backend, que
     * hoje tem quadros (`/quadros`) sem vínculo entre coluna e tarefa.
     */
    columns: (id: number) => `/api/projetos/${id}/colunas`,
    columnById: (id: number, columnId: number) => `/api/projetos/${id}/colunas/${columnId}`,
    columnOrder: (id: number) => `/api/projetos/${id}/colunas/ordem`,
  },
  tasks: {
    base: "/api/tarefas",
    byId: (id: number) => `/api/tarefas/${id}`,
    byProject: (projectId: number) => `/api/tarefas/projeto/${projectId}`,
    status: (id: number) => `/api/tarefas/${id}/status`,
    comments: (id: number) => `/api/tarefas/${id}/comentarios`,
    attachments: (id: number) => `/api/tarefas/${id}/anexos`,
    attachmentById: (id: number, attachmentId: number) => `/api/tarefas/${id}/anexos/${attachmentId}`,
    dependencies: (id: number) => `/api/tarefas/${id}/dependencias`,
    dependency: (id: number, prerequisiteId: number) =>
      `/api/tarefas/${id}/dependencias/${prerequisiteId}`,
    history: (id: number) => `/api/tarefas/${id}/historico`,
  },
  ai: {
    query: "/api/ia/consultar",
    summary: (projectId: number) => `/api/ia/projetos/${projectId}/resumo`,
    bottlenecks: (projectId: number) => `/api/ia/projetos/${projectId}/gargalos`,
    description: (taskId: number) => `/api/ia/tarefas/${taskId}/descricao`,
    dependencies: (taskId: number) => `/api/ia/tarefas/${taskId}/dependencias`,
    recommendations: (taskId: number) => `/api/ia/tarefas/${taskId}/recomendacoes`,
    recommendationFeedback: (taskId: number, recommendationId: number) =>
      `/api/ia/tarefas/${taskId}/recomendacoes/${recommendationId}/feedback`,
  },
  admin: {
    domain: "/api/admin/regras-dominio",
    projectDocuments: (projectId: number) => `/api/admin/projetos/${projectId}/documentos`,
    projectDocument: (projectId: number, documentId: number) =>
      `/api/admin/projetos/${projectId}/documentos/${documentId}`,
  },
} as const;
