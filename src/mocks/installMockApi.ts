import { AxiosError, CanceledError, type AxiosAdapter, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";
import { persist } from "./db";
import { HttpError, match } from "./handlers";

const CRUD_DELAY = 250;
const AI_DELAY = 1200;

function wait(ms: number, signal?: AbortSignal | { aborted?: boolean }) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    if (signal && "addEventListener" in signal) {
      (signal as AbortSignal).addEventListener("abort", () => {
        clearTimeout(timer);
        reject(new CanceledError());
      });
    }
  });
}

function parseBody(data: unknown) {
  if (typeof data === "string" && data) {
    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  }
  return data;
}

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  return { data, status, statusText: String(status), headers: {}, config, request: {} };
}

const adapter: AxiosAdapter = async (config) => {
  const url = new URL(config.url ?? "", "http://simulacao.local");
  const method = (config.method ?? "get").toLowerCase();
  const found = match(method, url.pathname);
  await wait(found?.route.ai ? AI_DELAY : CRUD_DELAY, config.signal);

  const fail = (status: number, body: unknown) => {
    const response = respond(config, status, body);
    throw new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, response);
  };

  if (!found) return fail(404, { status: 404, erro: "Not Found", mensagem: "Rota não encontrada na simulação." });

  const auth = String(config.headers?.Authorization ?? "");
  try {
    const result = found.route.handler({
      method,
      path: url.pathname,
      params: found.params,
      query: { ...Object.fromEntries(url.searchParams), ...(config.params ?? {}) },
      body: parseBody(config.data),
      token: auth.startsWith("Bearer ") ? auth.slice(7) : null,
    });
    persist();
    if (result === undefined) return respond(config, 204, "");
    return respond(config, method === "post" ? 201 : 200, result);
  } catch (error) {
    if (error instanceof HttpError) {
      return fail(error.status, { status: error.status, mensagem: error.message, erros: error.fields });
    }
    console.error("[simulação]", error);
    return fail(500, { status: 500, mensagem: "Erro interno na simulação." });
  }
};

/** Substitui o transporte HTTP do axios pelo backend simulado. Só é usado em `pnpm dev:mock`. */
export function installMockApi(instance: AxiosInstance) {
  instance.defaults.adapter = adapter;
}
