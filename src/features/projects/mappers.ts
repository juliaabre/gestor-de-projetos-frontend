import type {
  Project,
  ProjectInput,
  ProjectRequestDto,
  ProjectResponseDto,
  ProjectRole,
} from "./types";

const ROLE_FROM_API: Record<string, ProjectRole> = {
  ROLE_GERENTE: "MANAGER",
  ROLE_MEMBRO: "MEMBER",
};

export function toProject(dto: ProjectResponseDto): Project {
  const team = dto.equipe ?? [];
  return {
    id: dto.id,
    name: dto.nome,
    description: dto.descricao ?? null,
    archived: Boolean(dto.arquivado),
    creatorId: dto.criadorId ?? null,
    team,
    teamIds: dto.equipeIds ?? team.map((member) => member.id),
    taskIds: dto.tarefasIds ?? [],
    createdAt: dto.createdAt,
    myRole: dto.meuPapelNoProjeto
      ? (ROLE_FROM_API[dto.meuPapelNoProjeto] ?? null)
      : null,
    canManage: Boolean(dto.podeGerenciar),
  };
}

export function toProjectRequest(input: ProjectInput): ProjectRequestDto {
  return {
    nome: input.name,
    descricao: input.description,
    equipeIds: input.teamIds,
  };
}
