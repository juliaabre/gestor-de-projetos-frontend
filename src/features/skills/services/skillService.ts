import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import type { Skill, SkillDto, SkillInput, SkillRequestDto } from "../types";

export function toSkill(dto: SkillDto, userId: number): Skill {
  return {
    id: dto.id,
    userId: dto.usuarioId ?? userId,
    technologies: dto.tecnologias ?? [],
    activityType: dto.tipoAtividade,
    level: dto.nivelExperiencia,
  };
}

export function toSkillRequest(input: SkillInput): SkillRequestDto {
  return {
    tecnologias: input.technologies,
    tipoAtividade: input.activityType,
    nivelExperiencia: input.level,
  };
}

export async function listUserSkills(userId: number): Promise<Skill[]> {
  const { data } = await api.get<SkillDto[]>(endpoints.users.skills(userId));
  return data.map((dto) => toSkill(dto, userId));
}

export async function createSkill(userId: number, input: SkillInput): Promise<Skill> {
  const { data } = await api.post<SkillDto>(
    endpoints.users.skills(userId),
    toSkillRequest(input),
  );
  return toSkill(data, userId);
}

export async function updateSkill(
  userId: number,
  skillId: number,
  input: SkillInput,
): Promise<Skill> {
  const { data } = await api.put<SkillDto>(
    endpoints.users.skillById(userId, skillId),
    toSkillRequest(input),
  );
  return toSkill(data, userId);
}

export async function deleteSkill(userId: number, skillId: number): Promise<void> {
  await api.delete(endpoints.users.skillById(userId, skillId));
}
