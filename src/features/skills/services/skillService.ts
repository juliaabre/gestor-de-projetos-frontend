import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import type { ExperienceLevel, Skill, SkillDto, SkillInput } from "../types";

/** Agrupa os itens do backend por tipo de atividade e nível, na ordem recebida. */
export function toSkills(items: SkillDto[], userId: number): Skill[] {
  const groups = new Map<string, Skill>();
  for (const item of items) {
    const level = Math.min(5, Math.max(1, Math.round(item.nivel))) as ExperienceLevel;
    const key = `${item.tipoAtividade}|${level}`;
    const group = groups.get(key);
    if (group) group.technologies.push(item.tecnologia);
    else {
      groups.set(key, {
        id: groups.size + 1,
        userId,
        technologies: [item.tecnologia],
        activityType: item.tipoAtividade,
        level,
      });
    }
  }
  return [...groups.values()];
}

/** Uma entrada por tecnologia, como o `PUT /competencias` espera. */
export function toSkillItems(skills: SkillInput[]): SkillDto[] {
  return skills.flatMap((skill) =>
    skill.technologies.map((tecnologia) => ({
      tecnologia,
      tipoAtividade: skill.activityType,
      nivel: skill.level,
    })),
  );
}

export async function listUserSkills(userId: number): Promise<Skill[]> {
  const { data } = await api.get<SkillDto[]>(endpoints.users.skills(userId));
  return toSkills(data, userId);
}

/** O backend substitui a lista inteira; devolve a lista resultante. */
export async function saveSkills(userId: number, skills: SkillInput[]): Promise<Skill[]> {
  const { data } = await api.put<SkillDto[]>(endpoints.users.skills(userId), {
    competencias: toSkillItems(skills),
  });
  return toSkills(data, userId);
}

const strip = ({ technologies, activityType, level }: SkillInput): SkillInput => ({
  technologies,
  activityType,
  level,
});

export function createSkill(userId: number, input: SkillInput, current: Skill[]): Promise<Skill[]> {
  return saveSkills(userId, [...current.map(strip), input]);
}

export function updateSkill(userId: number, skillId: number, input: SkillInput, current: Skill[]): Promise<Skill[]> {
  return saveSkills(userId, current.map((skill) => (skill.id === skillId ? input : strip(skill))));
}

export function deleteSkill(userId: number, skillId: number, current: Skill[]): Promise<Skill[]> {
  return saveSkills(userId, current.filter((skill) => skill.id !== skillId).map(strip));
}
