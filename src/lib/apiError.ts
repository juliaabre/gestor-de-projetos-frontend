import axios from "axios";
import util from "@/lib/util.json";

export interface ApiErrorBody {
  status?: number;
  erro?: string;
  mensagem?: string;
  erros?: Record<string, string>;
}

function body(error: unknown): ApiErrorBody | undefined {
  if (!axios.isAxiosError(error)) return undefined;
  const data = error.response?.data;
  if (data && typeof data === "object") return data as ApiErrorBody;
  if (typeof data === "string" && data.trim().startsWith("{")) {
    try {
      return JSON.parse(data) as ApiErrorBody;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function getErrorMessage(error: unknown, fallback: string): string {
  const e = util.errors;
  if (axios.isAxiosError(error)) {
    if (!error.response) return e.network;
    const mensagem = body(error)?.mensagem;
    if (mensagem) return mensagem;
    switch (error.response.status) {
      case 400:
        return e.badRequest;
      case 401:
        return e.unauthorized;
      case 403:
        return e.forbidden;
      case 404:
        return e.notFound;
      case 409:
        return e.conflict;
    }
    if (error.response.status >= 500) return e.server;
  }
  return fallback;
}

export function getFieldErrors(error: unknown): Record<string, string> {
  return body(error)?.erros ?? {};
}

/** 403: o recurso existe, mas o perfil atual não tem acesso. */
export function isForbidden(error: unknown): boolean {
  return axios.isAxiosError(error) && error.response?.status === 403;
}

export function isUnavailable(error: unknown): boolean {
  if (!axios.isAxiosError(error) || !error.response) return false;
  return [404, 405, 501].includes(error.response.status);
}

/**
 * Classifica falhas de recursos de IA. "unavailable" cobre IA desligada ou
 * sobrecarregada (502/503/504), rota ainda inexistente e tempo esgotado; nesses
 * casos a interface avisa e mantém a edição manual disponível.
 */
export function getAiErrorKind(error: unknown): "unavailable" | "error" {
  if (!axios.isAxiosError(error)) return "error";
  if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return "unavailable";
  const status = error.response?.status;
  if (status == null) return "error";
  return [404, 405, 501, 502, 503, 504].includes(status) ? "unavailable" : "error";
}
