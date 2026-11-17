import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthResult, LoginCredentials, RegisterData, User } from "../types";
import {
  login as loginRequest,
  register as registerRequest,
} from "../services/authService";
import { SESSION_EXPIRED_EVENT } from "@/lib/axios";
import { isTokenExpired, session } from "@/lib/session";

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (data: LoginCredentials) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
}
const AuthContext = createContext<AuthContextValue | null>(null);

function restoreUser(): User | null {
  const token = session.getToken();
  const user = session.getUser<User>();
  if (!token || !user || isTokenExpired(token)) {
    session.clear();
    return null;
  }
  return user;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(restoreUser);
  const [isLoading, setIsLoading] = useState(false);

  const logout = useCallback(() => {
    session.clear();
    setUser(null);
  }, []);

  useEffect(() => {
    window.addEventListener(SESSION_EXPIRED_EVENT, logout);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, logout);
  }, [logout]);

  const run = useCallback(async (request: () => Promise<AuthResult>) => {
    setIsLoading(true);
    try {
      const { token, user } = await request();
      session.save(token, user);
      setUser(user);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isLoading,
      login: (data: LoginCredentials) => run(() => loginRequest(data)),
      register: (data: RegisterData) => run(() => registerRequest(data)),
      logout,
    }),
    [user, isLoading, run, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context)
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
