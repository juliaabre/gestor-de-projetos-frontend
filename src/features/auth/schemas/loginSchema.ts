import { z } from "zod";
import util from "@/lib/util.json";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, util.auth.login.errors.emailRequired)
    .email(util.auth.login.errors.emailInvalid),
  password: z.string().min(1, util.auth.login.errors.passwordRequired),
});

export type LoginFormData = z.infer<typeof loginSchema>;
