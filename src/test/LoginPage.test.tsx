import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/hooks/AuthContext";
import { LoginPage } from "../features/auth/pages/LoginPage";

describe("LoginPage", () => {
  it("renderiza campos e ação de entrada", () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
  });

  it("mostra validações para formulário vazio", async () => {
    const { default: userEvent } = await import("@testing-library/user-event");
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: /entrar/i }));
    expect(await screen.findByText("Informe seu e-mail.")).toBeInTheDocument();
    expect(screen.getByText("Informe sua senha.")).toBeInTheDocument();
  });

  it("expõe botão de senha acessível", () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Exibir senha" }),
    ).toBeInTheDocument();
  });
});
void vi;
