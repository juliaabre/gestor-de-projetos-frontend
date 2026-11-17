import { z } from "zod";
import util from "@/lib/util.json";

const e = util.auth.register.errors;

/** Mesmas regras de UsuarioRegisterRequestDTO no backend. */
export const registerSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, e.usernameRequired)
    .min(3, e.usernameLength)
    .max(50, e.usernameLength),
  email: z.string().trim().min(1, e.emailRequired).email(e.emailInvalid),
  password: z.string().min(1, e.passwordRequired).min(6, e.passwordLength),
});

export type RegisterFormData = z.infer<typeof registerSchema>;
