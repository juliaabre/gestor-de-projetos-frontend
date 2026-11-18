export const endpoints = {
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/auth/register",
  },
  users: {
    base: "/api/usuarios",
    byId: (id: number) => `/api/usuarios/${id}`,
  },
  projects: {
    base: "/api/projetos",
    byId: (id: number) => `/api/projetos/${id}`,
    archive: (id: number) => `/api/projetos/${id}/arquivar`,
    unarchive: (id: number) => `/api/projetos/${id}/desarquivar`,
  },
  tasks: {
    base: "/api/tarefas",
    byId: (id: number) => `/api/tarefas/${id}`,
    byProject: (projectId: number) => `/api/tarefas/projeto/${projectId}`,
  },
} as const;
