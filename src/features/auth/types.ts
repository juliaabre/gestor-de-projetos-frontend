export type UserRole = "ADMIN" | "MANAGER" | "MEMBER";

export const ROLE_FROM_API: Record<string, UserRole> = {
  ADMINISTRADOR: "ADMIN",
  GERENTE: "MANAGER",
  MEMBRO: "MEMBER",
};

export interface User {
  id?: number;
  username: string;
  email: string;
  roles: UserRole[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: User;
}
