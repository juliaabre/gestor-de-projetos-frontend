/** O backend aceita texto livre; estes são os valores sugeridos na tela. */
export type ActivityType =
  | (string & {})
  | "FRONTEND"
  | "BACKEND"
  | "MOBILE"
  | "BANCO_DE_DADOS"
  | "DEVOPS"
  | "TESTES"
  | "DESIGN"
  | "DADOS"
  | "GESTAO";

/** Nível de 1 a 5, como no backend. */
export type ExperienceLevel = 1 | 2 | 3 | 4 | 5;

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
  { value: 1, label: "Iniciante" },
  { value: 2, label: "Básico" },
  { value: 3, label: "Intermediário" },
  { value: 4, label: "Avançado" },
  { value: 5, label: "Especialista" },
];

/**
 * Na tela, uma competência agrupa várias tecnologias com o mesmo tipo de
 * atividade e nível. No backend cada tecnologia é um item.
 */
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

/** `CompetenciaRequest` do backend (usado no GET e no PUT da lista completa). */
export interface SkillDto {
  tecnologia: string;
  tipoAtividade: string;
  nivel: number;
}

export function labelOf<T extends string | number>(
  options: readonly { value: T; label: string }[],
  value: T | null | undefined,
): string {
  return options.find((option) => option.value === value)?.label ?? (value != null ? String(value) : "");
}
