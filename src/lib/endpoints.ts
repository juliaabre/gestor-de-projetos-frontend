export const endpoints = {
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/auth/register",
  },
  users: {
    base: "/api/usuarios",
    byId: (id: number) => `/api/usuarios/${id}`,
    skills: (userId: number) => `/api/usuarios/${userId}/competencias`,
    skillById: (userId: number, skillId: number) =>
      `/api/usuarios/${userId}/competencias/${skillId}`,
  },
  projects: {
    base: "/api/projetos",
    byId: (id: number) => `/api/projetos/${id}`,
    archive: (id: number) => `/api/projetos/${id}/arquivar`,
    unarchive: (id: number) => `/api/projetos/${id}/desarquivar`,
    columns: (id: number) => `/api/projetos/${id}/colunas`,
    columnById: (id: number, columnId: number) =>
      `/api/projetos/${id}/colunas/${columnId}`,
  },
  tasks: {
    base: "/api/tarefas",
    byId: (id: number) => `/api/tarefas/${id}`,
    byProject: (projectId: number) => `/api/tarefas/projeto/${projectId}`,
    comments: (id: number) => `/api/tarefas/${id}/comentarios`,
    attachments: (id: number) => `/api/tarefas/${id}/anexos`,
    attachmentDownload: (id: number, attachmentId: number) =>
      `/api/tarefas/${id}/anexos/${attachmentId}/download`,
    history: (id: number) => `/api/tarefas/${id}/historico`,
  },
} as const;
