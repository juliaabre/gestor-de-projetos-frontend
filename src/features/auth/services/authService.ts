import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { decodeJwt } from "@/lib/session";
import { findUserByEmail } from "@/features/users/services/userService";
import {
  ROLE_FROM_API,
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

export function extractToken(data: unknown): string {
  if (typeof data === "string" && data.trim()) return data.trim();
  if (data && typeof data === "object" && "token" in data) {
    const token = (data as { token?: unknown }).token;
    if (typeof token === "string" && token) return token;
  }
  throw new Error("Resposta de autenticação sem token.");
}

export function extractRoles(token: string): UserRole[] {
  const payload = decodeJwt(token);
  const raw = payload?.roles ?? payload?.authorities;
  if (!Array.isArray(raw)) return [];
  const roles = raw
    .map((role) =>
      typeof role === "string"
        ? role
        : (role as { authority?: string })?.authority,
    )
    .filter((role): role is string => typeof role === "string")
    .map((role) => ROLE_FROM_API[role.replace(/^ROLE_/, "")])
    .filter((role): role is UserRole => Boolean(role));
  return [...new Set(roles)];
}

export async function resolveUser(
  token: string,
  emailFallback: string,
): Promise<User> {
  const email = decodeJwt(token)?.sub ?? emailFallback;
  const roles = extractRoles(token);
  try {
    const profile = await findUserByEmail(email, token);
    if (profile) return { ...profile, roles };
  } catch {}
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

export async function login(
  credentials: LoginCredentials,
): Promise<AuthResult> {
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
        roles: ["MANAGER"],
      },
    };
  }
  return authenticate(endpoints.auth.login, credentials);
}

export async function register(data: RegisterData): Promise<AuthResult> {
  return authenticate(endpoints.auth.register, data);
}
