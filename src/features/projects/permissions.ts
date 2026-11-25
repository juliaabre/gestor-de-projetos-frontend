import type { User } from "@/features/auth/types";
import type { Project } from "./types";

/**
 * Permissões visuais, espelhando o backend (CONTROLE_DE_ACESSO.md):
 * - integrante da equipe: vê o projeto, muda o status das tarefas, comenta,
 *   anexa e consulta o assistente;
 * - gerente do projeto (`podeGerenciar`): cria, edita e exclui tarefas,
 *   gerencia dependências, equipe e colunas e usa as funções de IA de gestão;
 * - administrador: só competências de qualquer usuário e a área /admin. Ele
 *   não gerencia projetos dos quais não é o gerente.
 * Projetos arquivados ficam somente leitura.
 */
export function getProjectPermissions(project: Project, user: User | null) {
  const isAdmin = Boolean(user?.roles.includes("ADMIN"));
  const isMember =
    project.canManage ||
    project.myRole != null ||
    (user?.id != null && project.teamIds.includes(user.id));
  const writable = !project.archived;
  const manages = writable && project.canManage;

  return {
    /** Mudar o status (mover no quadro). */
    canMoveTasks: writable && isMember,
    /** Criar e editar tarefas inteiras, inclusive dependências. */
    canEditTasks: manages,
    canDeleteTasks: manages,
    canManageColumns: manages,
    /** Recomendação de responsável, resumo, gargalos, descrição e dependências com IA. */
    canUseManagerAi: manages,
    canDecideAssignment: manages,
    canCollaborate: writable && isMember,
    canEditSkillsOf: (userId: number) => user?.id === userId || isAdmin,
  };
}

export type ProjectPermissions = ReturnType<typeof getProjectPermissions>;
