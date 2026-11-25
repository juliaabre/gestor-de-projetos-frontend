import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, AxiosHeaders } from "axios";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { session } from "@/lib/session";
import { apiError } from "./fixtures";

const authService = vi.hoisted(() => ({ login: vi.fn(), register: vi.fn() }));
vi.mock("@/features/auth/services/authService", () => authService);

import { AuthProvider, useAuth } from "@/features/auth/hooks/AuthContext";
import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";

const USER = { id: 1, username: "ana", email: "ana@ex.com", roles: ["MANAGER"] };

function Dashboard() {
  const { user } = useAuth();
  return <p>Olá, {user?.username}</p>;
}

function renderAt(path: "/login" | "/register") {
  render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  );
}

async function fillLogin(password = "senha123") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail"), "ana@ex.com");
  await user.type(screen.getByLabelText("Senha"), password);
  await user.click(screen.getByRole("button", { name: /entrar/i }));
  return user;
}

beforeEach(() => {
  vi.clearAllMocks();
  session.clear();
});

describe("fluxo de login", () => {
  it("entra, guarda a sessão e vai para o início", async () => {
    authService.login.mockResolvedValue({ token: "jwt", user: USER });
    renderAt("/login");
    expect(document.title).toBe("Entrar · Gestor de Projetos");
    await fillLogin();
    expect(await screen.findByText("Olá, ana")).toBeInTheDocument();
    expect(authService.login).toHaveBeenCalledWith({ email: "ana@ex.com", password: "senha123" });
    expect(session.getToken()).toBe("jwt");
  });

  it("desabilita o botão enquanto a requisição está em andamento", async () => {
    let resolve!: (value: unknown) => void;
    authService.login.mockReturnValue(new Promise((r) => (resolve = r)));
    renderAt("/login");
    await fillLogin();
    expect(await screen.findByRole("button", { name: /entrando/i })).toBeDisabled();
    resolve({ token: "jwt", user: USER });
    expect(await screen.findByText("Olá, ana")).toBeInTheDocument();
  });

  it("credenciais erradas mostram aviso e mantêm o formulário", async () => {
    authService.login.mockRejectedValue(apiError(401, "E-mail ou senha inválidos."));
    renderAt("/login");
    await fillLogin("errada");
    expect(await screen.findByRole("alert")).toHaveTextContent("E-mail ou senha inválidos.");
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@ex.com");
    expect(session.getToken()).toBeNull();
  });

  it("servidor fora do ar mostra aviso de conexão", async () => {
    authService.login.mockRejectedValue(
      new AxiosError("Network Error", "ERR_NETWORK", { headers: new AxiosHeaders() }),
    );
    renderAt("/login");
    await fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível conectar ao servidor.");
  });

  it("erro inesperado do servidor mostra mensagem genérica", async () => {
    authService.login.mockRejectedValue(apiError(500));
    renderAt("/login");
    await fillLogin();
    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível entrar agora");
  });
});

describe("fluxo de cadastro", () => {
  it("cria a conta e entra direto", async () => {
    authService.register.mockResolvedValue({ token: "jwt", user: { ...USER, roles: ["MEMBER"] } });
    const user = userEvent.setup();
    renderAt("/register");
    await user.type(screen.getByLabelText(/nome de usuário|username/i), "ana");
    await user.type(screen.getByLabelText("E-mail"), "ana@ex.com");
    await user.type(screen.getByLabelText("Senha"), "senha123");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(await screen.findByText("Olá, ana")).toBeInTheDocument();
    expect(authService.register).toHaveBeenCalledWith({ username: "ana", email: "ana@ex.com", password: "senha123" });
  });

  it("e-mail já usado mostra o erro sem perder os dados", async () => {
    authService.register.mockRejectedValue(apiError(409, "E-mail já cadastrado."));
    const user = userEvent.setup();
    renderAt("/register");
    await user.type(screen.getByLabelText(/nome de usuário|username/i), "ana");
    await user.type(screen.getByLabelText("E-mail"), "ana@ex.com");
    await user.type(screen.getByLabelText("Senha"), "senha123");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toHaveValue("ana@ex.com");
  });
});
