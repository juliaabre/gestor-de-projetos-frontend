import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { decodeJwt } from "@/lib/session";
import { buscarUsuarioPorEmail } from "@/features/usuarios/services/usuarioService";
import {
  USER_ROLES,
  type AuthResult,
  type LoginCredentials,
  type RegisterData,
  type User,
  type UserRole,
} from "../types";

const mockAuthCredentials = {
  email: import.meta.env.VITE_MOCK_AUTH_EMAIL,
  password: import.meta.env.VITE_MOCK_AUTH_PASSWORD,
};
export const isMockAuthEnabled =
  import.meta.env.VITE_ENABLE_MOCK_AUTH === "true" &&
  Boolean(mockAuthCredentials.email && mockAuthCredentials.password);

/**
 * Hoje o AuthController devolve o JWT como texto puro (`ResponseEntity<String>`),
 * mas os testes do backend esperam `{ "token": "..." }`. Aceitamos os dois.
 */
export function extractToken(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object" && "token" in data) {
    const token = (data as { token?: unknown }).token;
    if (typeof token === "string" && token) return token;
  }
  throw new Error("Resposta de autenticação sem token.");
}

/** Lê papéis do JWT caso o backend passe a incluí-los (claims `roles`/`authorities`). */
export function extractRoles(token: string): UserRole[] {
  const payload = decodeJwt(token);
  const raw = payload?.roles ?? payload?.authorities;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => (typeof r === "string" ? r : (r as { authority?: string })?.authority))
    .filter((r): r is string => typeof r === "string")
    .map((r) => r.replace(/^ROLE_/, "") as UserRole)
    .filter((r) => USER_ROLES.includes(r));
}

/** Monta o usuário logado a partir do token + GET /api/usuarios. */
export async function resolveUser(token: string, emailFallback: string): Promise<User> {
  const email = decodeJwt(token)?.sub ?? emailFallback;
  const roles = extractRoles(token);
  try {
    // A sessão ainda não foi gravada, então o token vai explicitamente.
    const usuario = await buscarUsuarioPorEmail(email, token);
    if (usuario) return { ...usuario, roles };
  } catch {
    // Sem perfil completo, seguimos só com os dados do token.
  }
  return { email, username: email.split("@")[0], roles };
}

async function authenticate(
  path: string,
  body: LoginCredentials | RegisterData,
): Promise<AuthResult> {
  const { data } = await api.post(path, body, { responseType: "text" });
  let parsed: unknown = data;
  if (typeof data === "string" && data.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(data);
    } catch {
      /* texto puro */
    }
  }
  const token = extractToken(parsed);
  const user = await resolveUser(token, body.email);
  return { token, user };
}

export async function login(credentials: LoginCredentials): Promise<AuthResult> {
  if (
    isMockAuthEnabled &&
    credentials.email === mockAuthCredentials.email &&
    credentials.password === mockAuthCredentials.password
  ) {
    return {
      token: "mock-development-token",
      user: {
        id: 0,
        username: "Usuário de desenvolvimento",
        email: mockAuthCredentials.email,
        roles: ["GERENTE"],
      },
    };
  }
  return authenticate(endpoints.auth.login, credentials);
}

export async function register(data: RegisterData): Promise<AuthResult> {
  return authenticate(endpoints.auth.register, data);
}
