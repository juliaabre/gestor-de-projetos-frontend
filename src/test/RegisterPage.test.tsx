import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../features/auth/hooks/AuthContext";
import { RegisterPage } from "../features/auth/pages/RegisterPage";

function renderPage() {
  render(
    <MemoryRouter>
      <AuthProvider>
        <RegisterPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("RegisterPage", () => {
  it("renderiza os campos exigidos por UsuarioRegisterRequestDTO", () => {
    renderPage();
    expect(screen.getByLabelText("Nome de usuário")).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByLabelText("Senha")).toBeInTheDocument();
  });

  it("aplica as mesmas validações do backend", async () => {
    renderPage();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Nome de usuário"), "ab");
    await user.type(screen.getByLabelText("E-mail"), "a@b.com");
    await user.type(screen.getByLabelText("Senha"), "123");
    await user.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(
      await screen.findByText("O nome de usuário deve ter entre 3 e 50 caracteres."),
    ).toBeInTheDocument();
    expect(screen.getByText("A senha deve ter pelo menos 6 caracteres.")).toBeInTheDocument();
  });
});
