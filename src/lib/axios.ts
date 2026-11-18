import axios from "axios";
import { session } from "./session";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: { "Content-Type": "application/json" },
});

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
    if (
      axios.isAxiosError(error) &&
      hadToken &&
      error.response?.status === 401
    ) {
      session.clear();
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    return Promise.reject(error);
  },
);
