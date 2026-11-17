/**
 * Papéis do backend (enum TipoRole / tabela tb_papeis). O Spring gera a
 * authority como "ROLE_" + nome, então aqui guardamos só o nome.
 */
export type UserRole = "ADMINISTRADOR" | "GERENTE" | "MEMBRO";

export const USER_ROLES: readonly UserRole[] = ["ADMINISTRADOR", "GERENTE", "MEMBRO"];

/** Espelha UsuarioResponseDTO + papéis. */
export interface User {
  /** Pode faltar se a consulta a /api/usuarios falhar após o login. */
  id?: number;
  username: string;
  email: string;
  /**
   * O backend ainda não expõe os papéis (não vão no JWT nem no
   * UsuarioResponseDTO). Fica vazio até isso existir.
   */
  roles: UserRole[];
  createdAt?: string;
  updatedAt?: string;
}

/** UsuarioLoginRequestDTO */
export interface LoginCredentials {
  email: string;
  password: string;
}

/** UsuarioRegisterRequestDTO */
export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

export interface AuthResult {
  token: string;
  user: User;
}
