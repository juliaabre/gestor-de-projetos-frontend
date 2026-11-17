/**
 * Rotas expostas pelo backend Spring (gestor-de-projetos-com-retrieval-augmented-generation).
 *
 * Os prefixos não são uniformes no backend (`/api/v1/auth`, `/api/usuarios`,
 * `/api/tarefas` e `/projetos`, este último sem `/api`). Por isso o cliente
 * Axios usa a raiz do servidor como baseURL e cada caminho fica completo aqui.
 * Se o backend padronizar os prefixos, basta ajustar este arquivo.
 */
export const endpoints = {
  auth: {
    login: "/api/v1/auth/login",
    register: "/api/v1/auth/register",
  },
  usuarios: {
    base: "/api/usuarios",
    byId: (id: number) => `/api/usuarios/${id}`,
  },
  projetos: {
    base: "/projetos",
    byId: (id: number) => `/projetos/${id}`,
  },
  tarefas: {
    base: "/api/tarefas",
    byId: (id: number) => `/api/tarefas/${id}`,
    byProjeto: (projetoId: number) => `/api/tarefas/projeto/${projetoId}`,
  },
} as const;
