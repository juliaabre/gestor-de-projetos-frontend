export type ProjectRole = "MANAGER" | "MEMBER";

export interface TeamMember {
  id: number;
  username: string;
  email: string;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  archived: boolean;
  creatorId: number | null;
  /** Gerente atual do projeto (a gerência vale só para este projeto). */
  managerId: number | null;
  team: TeamMember[];
  teamIds: number[];
  taskIds: number[];
  createdAt?: string;
  myRole: ProjectRole | null;
  canManage: boolean;
  canAddMembers: boolean;
}

export interface ProjectInput {
  name: string;
  description?: string;
  teamIds?: number[];
  /** Transfere a gerência para um integrante (somente na edição). */
  managerId?: number;
}

export interface ProjectRequestDto {
  nome: string;
  descricao?: string;
  equipeIds?: number[];
  gerenteId?: number;
}

export interface TeamMemberDto {
  id: number;
  username: string;
  email: string;
}

export interface ProjectResponseDto {
  id: number;
  nome: string;
  descricao?: string | null;
  arquivado: boolean;
  criadorId?: number | null;
  gerenteId?: number | null;
  equipe?: TeamMemberDto[] | null;
  equipeIds?: number[] | null;
  tarefasIds?: number[] | null;
  createdAt?: string;
  meuPapelNoProjeto?: "ROLE_GERENTE" | "ROLE_MEMBRO" | null;
  podeGerenciar: boolean;
  podeAdicionarMembros?: boolean;
}
