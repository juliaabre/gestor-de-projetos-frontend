import { z } from "zod";
import util from "@/lib/util.json";

const t = util.tasks.form;

export const taskSchema = z.object({
  title: z.string().trim().min(1, t.titleRequired).max(255, t.titleTooLong),
  content: z.string().trim().max(5000, t.textTooLong),
  requirements: z.string().trim().max(5000, t.textTooLong),
  technologies: z.array(z.string()).max(15, t.technologiesTooMany),
  status: z.string().min(1, t.statusRequired),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"], { message: t.priorityRequired }),
  complexity: z.enum(["", "LOW", "MEDIUM", "HIGH"]),
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
