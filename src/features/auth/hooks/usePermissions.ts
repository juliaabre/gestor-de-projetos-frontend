import { useAuth } from "./AuthContext";
import type { UserRole } from "../types";

export function usePermissions() {
  const { user } = useAuth();
  return {
    can: (roles: UserRole[]) => Boolean(user && roles.includes(user.role)),
  };
}
