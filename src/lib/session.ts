const TOKEN_KEY = "gestor.auth.token";
const USER_KEY = "gestor.auth.user";

function storage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export const session = {
  getToken(): string | null {
    return storage()?.getItem(TOKEN_KEY) ?? null;
  },
  getUser<T>(): T | null {
    const raw = storage()?.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  save(token: string, user: unknown) {
    storage()?.setItem(TOKEN_KEY, token);
    storage()?.setItem(USER_KEY, JSON.stringify(user));
  },
  clear() {
    storage()?.removeItem(TOKEN_KEY);
    storage()?.removeItem(USER_KEY);
  },
};

export interface JwtPayload {
  sub?: string;
  exp?: number;
  iat?: number;
  [claim: string]: unknown;
}

export function decodeJwt(token: string): JwtPayload | null {
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "=",
    );
    const json = decodeURIComponent(
      Array.from(
        atob(padded),
        (c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"),
      ).join(""),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string, skewSeconds = 10): boolean {
  const exp = decodeJwt(token)?.exp;
  if (!exp) return false;
  return exp * 1000 <= Date.now() + skewSeconds * 1000;
}
