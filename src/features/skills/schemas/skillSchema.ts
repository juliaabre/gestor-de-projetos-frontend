import { z } from "zod";
import util from "@/lib/util.json";
import { ACTIVITY_TYPES, EXPERIENCE_LEVELS } from "../types";

const t = util.skills.form;

const oneOf = (options: readonly { value: string | number }[], message: string) =>
  z.string().refine((value) => options.some((o) => String(o.value) === value), message);

export const skillSchema = z.object({
  technologies: z
    .array(z.string().trim().min(1).max(100))
    .min(1, t.technologiesRequired)
    .max(50, t.technologiesTooMany),
  activityType: oneOf(ACTIVITY_TYPES, t.activityRequired),
  level: oneOf(EXPERIENCE_LEVELS, t.levelRequired),
});

export type SkillFormData = z.infer<typeof skillSchema>;
