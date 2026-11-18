import { z } from "zod";
import util from "@/lib/util.json";

const t = util.projects.form;

export const projectSchema = z.object({
  name: z.string().trim().min(1, t.nameRequired).max(255, t.nameTooLong),
  description: z.string().trim(),
});

export type ProjectFormData = z.infer<typeof projectSchema>;
