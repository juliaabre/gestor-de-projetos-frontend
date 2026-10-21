export type UserRole = "ADMIN" | "PROJECT_MANAGER" | "MEMBER";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  token?: string;
  user: User;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
