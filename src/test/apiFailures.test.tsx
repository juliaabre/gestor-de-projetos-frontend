import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { AxiosError, AxiosHeaders, type AxiosAdapter } from "axios";
import { MemoryRouter, Outlet, Route, RouterProvider, Routes, createMemoryRouter, Navigate } from "react-router-dom";
import { SESSION_EXPIRED_EVENT, api } from "@/lib/axios";
import { session } from "@/lib/session";
import { getAiErrorKind, getErrorMessage, getFieldErrors, isUnavailable } from "@/lib/apiError";
import { AuthProvider, useAuth } from "@/features/auth/hooks/AuthContext";
import { RouteError } from "@/app/RouteError";
import { apiError } from "./fixtures";

/** JWT sem assinatura, suficiente para o frontend ler `sub` e `exp`. */
function fakeJwt(expSeconds: number) {
  const encode = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  return `${encode({ alg: "none" })}.${encode({ sub: "ana@ex.com", exp: expSeconds })}.x`;
}

const networkError = () =>
  new AxiosError("Network Error", "ERR_NETWORK", { headers: new AxiosHeaders() });

describe("mensagens para falhas da API", () => {
  it.each([
    [400, "Os dados enviados são inválidos. Revise o formulário."],
    [401, "Sua sessão expirou. Entre novamente."],
    [403, "Você não tem permissão para realizar esta operação."],
    [404, "O recurso solicitado não foi encontrado."],
    [409, "A operação não pôde ser concluída por um conflito com o estado atual."],
    [500, "O servidor encontrou um erro. Tente novamente em instantes."],
    [503, "O servidor encontrou um erro. Tente novamente em instantes."],
  ])("HTTP %i vira texto compreensível", (status, message) => {
    expect(getErrorMessage(apiError(status), "fallback")).toBe(message);
  });

  it("prefere a mensagem enviada pelo backend", () => {
    expect(getErrorMessage(apiError(409, "Projetos arquivados não podem ser editados."), "x")).toBe(
      "Projetos arquivados não podem ser editados.",
    );
  });

  it("sem resposta do servidor informa problema de conexão", () => {
    expect(getErrorMessage(networkError(), "x")).toMatch(/conectar ao servidor/);
  });

  it("erros que não vêm da API usam o texto padrão da tela", () => {
    expect(getErrorMessage(new Error("boom"), "Não foi possível salvar.")).toBe("Não foi possível salvar.");
  });

  it("lê erros por campo do corpo da resposta, inclusive quando vem como texto", () => {
    const error = apiError(400);
    error.response!.data = JSON.stringify({ erros: { titulo: "Title is required" } });
    expect(getFieldErrors(error)).toEqual({ titulo: "Title is required" });
    expect(getFieldErrors(new Error("x"))).toEqual({});
  });

  it("distingue recurso inexistente (modo indisponível) de falha real", () => {
    expect(isUnavailable(apiError(404))).toBe(true);
    expect(isUnavailable(apiError(501))).toBe(true);
    expect(isUnavailable(apiError(500))).toBe(false);
    expect(isUnavailable(networkError())).toBe(false);
  });

  it("IA fora do ar, sobrecarregada ou lenta é tratada como indisponível", () => {
    expect(getAiErrorKind(apiError(503))).toBe("unavailable");
    expect(getAiErrorKind(new AxiosError("timeout", "ECONNABORTED"))).toBe("unavailable");
    expect(getAiErrorKind(apiError(500))).toBe("error");
    expect(getAiErrorKind(apiError(403))).toBe("error");
  });
});

describe("sessão expirada", () => {
  const original = api.defaults.adapter;
  const respond401: AxiosAdapter = (config) =>
    Promise.reject(
      new AxiosError("Unauthorized", "401", config, null, {
        status: 401,
        statusText: "Unauthorized",
        headers: {},
        config,
        data: "",
      }),
    );

  beforeEach(() => {
    session.clear();
    api.defaults.adapter = respond401;
  });
  afterEach(() => {
    api.defaults.adapter = original;
    session.clear();
  });

  it("401 com token limpa a sessão e avisa a aplicação", async () => {
    session.save(fakeJwt(Date.now() / 1000 + 3600), { email: "ana@ex.com" });
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    await expect(api.get("/api/projetos")).rejects.toBeInstanceOf(AxiosError);
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    expect(listener).toHaveBeenCalledOnce();
    expect(session.getToken()).toBeNull();
  });

  it("401 sem token (ex.: senha errada no login) não derruba a sessão", async () => {
    const listener = vi.fn();
    window.addEventListener(SESSION_EXPIRED_EVENT, listener);
    await expect(api.post("/api/v1/auth/login", {})).rejects.toBeInstanceOf(AxiosError);
    window.removeEventListener(SESSION_EXPIRED_EVENT, listener);
    expect(listener).not.toHaveBeenCalled();
  });

  function Protected() {
    const { user } = useAuth();
    return user ? <Outlet /> : <Navigate to="/login" replace />;
  }

  function renderApp() {
    render(
      <AuthProvider>
        <MemoryRouter initialEntries={["/projects"]}>
          <Routes>
            <Route element={<Protected />}>
              <Route path="/projects" element={<p>Projetos</p>} />
            </Route>
            <Route path="/login" element={<p>Tela de login</p>} />
          </Routes>
        </MemoryRouter>
      </AuthProvider>,
    );
  }

  it("ao expirar durante o uso, a aplicação volta para o login", () => {
    session.save(fakeJwt(Date.now() / 1000 + 3600), { username: "ana", email: "ana@ex.com", roles: [] });
    renderApp();
    expect(screen.getByText("Projetos")).toBeInTheDocument();
    act(() => window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT)));
    expect(screen.getByText("Tela de login")).toBeInTheDocument();
  });

  it("token vencido guardado no navegador não é reaproveitado", () => {
    session.save(fakeJwt(Date.now() / 1000 - 60), { username: "ana", email: "ana@ex.com", roles: [] });
    renderApp();
    expect(screen.getByText("Tela de login")).toBeInTheDocument();
    expect(session.getToken()).toBeNull();
  });
});

describe("erro inesperado em uma tela", () => {
  it("mostra uma tela de recuperação em vez de quebrar a aplicação", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    function Broken(): never {
      throw new Error("falha de renderização");
    }
    const router = createMemoryRouter(
      [{ errorElement: <RouteError />, children: [{ path: "/", element: <Broken /> }] }],
      { initialEntries: ["/"] },
    );
    render(<RouterProvider router={router} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Algo deu errado nesta tela");
    expect(screen.getByRole("button", { name: "Recarregar página" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Voltar para o início" })).toHaveAttribute("href", "/dashboard");
    vi.mocked(console.error).mockRestore();
  });
});
