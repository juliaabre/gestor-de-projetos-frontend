import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";

/** UsuarioResponseDTO */
export interface UsuarioResponse {
  id: number;
  username: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function listarUsuarios(token?: string): Promise<UsuarioResponse[]> {
  const { data } = await api.get<UsuarioResponse[]>(
    endpoints.usuarios.base,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  return data;
}

export async function buscarUsuario(id: number): Promise<UsuarioResponse> {
  const { data } = await api.get<UsuarioResponse>(endpoints.usuarios.byId(id));
  return data;
}

/**
 * O backend não tem endpoint "/me"; procuramos pelo e-mail (que é o `sub` do
 * JWT) na listagem de usuários.
 */
export async function buscarUsuarioPorEmail(
  email: string,
  token?: string,
): Promise<UsuarioResponse | null> {
  const usuarios = await listarUsuarios(token);
  const alvo = email.toLowerCase();
  return usuarios.find((u) => u.email?.toLowerCase() === alvo) ?? null;
}
