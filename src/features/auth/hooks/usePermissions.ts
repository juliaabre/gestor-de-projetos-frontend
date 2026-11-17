import { useAuth } from "./AuthContext";
import type { UserRole } from "../types";

/**
 * Controle apenas visual; a autorização real é feita pelo backend.
 * Enquanto o backend não expuser os papéis do usuário, `roles` vem vazio e
 * `can` retorna false.
 */
export function usePermissions() {
  const { user } = useAuth();
  return {
    can: (roles: UserRole[]) =>
      Boolean(user && user.roles.some((role) => roles.includes(role))),
  };
}
