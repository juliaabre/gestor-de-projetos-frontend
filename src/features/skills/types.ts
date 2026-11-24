export type ActivityType =
  | "FRONTEND"
  | "BACKEND"
  | "MOBILE"
  | "BANCO_DE_DADOS"
  | "DEVOPS"
  | "TESTES"
  | "DESIGN"
  | "DADOS"
  | "GESTAO";

export type ExperienceLevel = "INICIANTE" | "INTERMEDIARIO" | "AVANCADO" | "ESPECIALISTA";

export const ACTIVITY_TYPES: readonly { value: ActivityType; label: string }[] = [
  { value: "FRONTEND", label: "Front-end" },
  { value: "BACKEND", label: "Back-end" },
  { value: "MOBILE", label: "Mobile" },
  { value: "BANCO_DE_DADOS", label: "Banco de dados" },
  { value: "DEVOPS", label: "DevOps / Infraestrutura" },
  { value: "TESTES", label: "Testes / QA" },
  { value: "DESIGN", label: "Design / UX" },
  { value: "DADOS", label: "Dados / IA" },
  { value: "GESTAO", label: "Gestão" },
];

export const EXPERIENCE_LEVELS: readonly { value: ExperienceLevel; label: string }[] = [
  { value: "INICIANTE", label: "Iniciante" },
  { value: "INTERMEDIARIO", label: "Intermediário" },
  { value: "AVANCADO", label: "Avançado" },
  { value: "ESPECIALISTA", label: "Especialista" },
];

export interface Skill {
  id: number;
  userId: number;
  technologies: string[];
  activityType: ActivityType;
  level: ExperienceLevel;
}

export interface SkillInput {
  technologies: string[];
  activityType: ActivityType;
  level: ExperienceLevel;
}

export interface SkillDto {
  id: number;
  usuarioId?: number | null;
  tecnologias?: string[] | null;
  tipoAtividade: ActivityType;
  nivelExperiencia: ExperienceLevel;
}

export interface SkillRequestDto {
  tecnologias: string[];
  tipoAtividade: ActivityType;
  nivelExperiencia: ExperienceLevel;
}

export function labelOf<T extends string>(
  options: readonly { value: T; label: string }[],
  value: T | null | undefined,
): string {
  return options.find((option) => option.value === value)?.label ?? value ?? "";
}
