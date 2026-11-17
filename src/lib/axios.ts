import axios from "axios";
import { session } from "./session";

/**
 * Em desenvolvimento a baseURL fica vazia e o Vite encaminha `/api` e
 * `/projetos` para o backend (ver `server.proxy` em vite.config.ts), o que
 * evita problemas de CORS — o backend ainda não tem CORS configurado.
 * Em produção, defina VITE_API_BASE_URL com a raiz do servidor
 * (ex.: https://api.exemplo.com), sem `/api` no final.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: { "Content-Type": "application/json" },
});

/** Disparado quando o servidor rejeita o token; o AuthContext escuta e desloga. */
export const SESSION_EXPIRED_EVENT = "auth:session-expired";

api.interceptors.request.use((config) => {
  const token = session.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    if (axios.isAxiosError(error) && hadToken && error.response?.status === 401) {
      session.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
