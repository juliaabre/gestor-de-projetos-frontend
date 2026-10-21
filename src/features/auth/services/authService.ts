import { api } from "@/lib/axios";
import type { LoginCredentials, LoginResponse } from "../types";

const mockAuthCredentials = {
  email: import.meta.env.VITE_MOCK_AUTH_EMAIL,
  password: import.meta.env.VITE_MOCK_AUTH_PASSWORD,
};
const isMockAuthEnabled =
  import.meta.env.VITE_ENABLE_MOCK_AUTH === "true" &&
  Boolean(mockAuthCredentials.email && mockAuthCredentials.password);

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  if (
    isMockAuthEnabled &&
    credentials.email === mockAuthCredentials.email &&
    credentials.password === mockAuthCredentials.password
  ) {
    return {
      token: "mock-development-token",
      user: {
        id: "mock-user-1",
        name: "Usuário de desenvolvimento",
        email: mockAuthCredentials.email,
        role: "PROJECT_MANAGER",
      },
    };
  }

  const { data } = await api.post("/auth/login", credentials);
  return {
    token: data.token,
    user: {
      id: String(data.user.id),
      name: data.user.name,
      email: data.user.email,
      role: data.user.role,
    },
  };
}
