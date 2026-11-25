import { z } from "zod";
import util from "@/lib/util.json";

const t = util.tasks.form;

export const taskSchema = z.object({
  title: z.string().trim().min(1, t.titleRequired).max(255, t.titleTooLong),
  content: z.string().trim().max(5000, t.textTooLong),
  requirements: z.string().trim().max(10000, t.requirementsTooLong),
  technologies: z.array(z.string()).max(30, t.technologiesTooMany),
  status: z.string().min(1, t.statusRequired),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"], { message: t.priorityRequired }),
  /** "" (sem complexidade) ou "1" a "5", como no backend. */
  complexity: z.enum(["", "1", "2", "3", "4", "5"]),
  dueDate: z
    .string()
    .refine(
      (value) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))),
      t.dueDateInvalid,
    ),
  assigneeId: z.string(),
  dependencyIds: z.array(z.number()),
});

export type TaskFormData = z.infer<typeof taskSchema>;
