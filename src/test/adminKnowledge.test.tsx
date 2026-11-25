import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiError } from "./fixtures";

const auth = vi.hoisted(() => ({ user: null as null | { id: number; username: string; email: string; roles: string[] } }));
const knowledge = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  listRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
  listTerms: vi.fn(),
  createTerm: vi.fn(),
  updateTerm: vi.fn(),
  deleteTerm: vi.fn(),
}));

vi.mock("@/features/admin/services/knowledgeService", () => knowledge);
vi.mock("@/features/projects/services/projectService", () => ({
  listProjects: vi.fn().mockResolvedValue([{ id: 10, name: "Sistema RAG" }]),
}));
vi.mock("@/features/auth/hooks/AuthContext", () => ({ useAuth: () => ({ user: auth.user, logout: vi.fn() }) }));

import { AdminRoute } from "@/app/router";
import { KnowledgeBasePage } from "@/features/admin/pages/KnowledgeBasePage";

function renderAdmin(path = "/admin/conhecimento") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin/conhecimento" element={<KnowledgeBasePage />} />
        </Route>
        <Route path="/unauthorized" element={<p>Acesso negado</p>} />
        <Route path="/login" element={<p>Login</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

const ADMIN = { id: 9, username: "root", email: "root@ex.com", roles: ["ADMIN"] };

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = ADMIN;
  knowledge.listDocuments.mockResolvedValue([]);
  knowledge.listRules.mockResolvedValue([]);
  knowledge.listTerms.mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("Base de conhecimento", () => {
  it("bloqueia quem não é administrador", () => {
    auth.user = { ...ADMIN, roles: ["MANAGER", "MEMBER"] };
    renderAdmin();
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
    expect(knowledge.listDocuments).not.toHaveBeenCalled();
  });

  it("valida o tipo do arquivo e mostra o status de processamento até indexar", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ applyAccept: false, advanceTimers: vi.advanceTimersByTime });
    knowledge.uploadDocument.mockResolvedValue({
      id: 1, fileName: "guia.pdf", contentType: "application/pdf", size: 3, status: "PROCESSING",
      errorMessage: null, chunks: null, projectId: 10,
    });
    knowledge.listDocuments
      .mockResolvedValueOnce([])
      .mockResolvedValue([
        { id: 1, fileName: "guia.pdf", contentType: "application/pdf", size: 3, status: "INDEXED", errorMessage: null, chunks: 12, projectId: 10 },
      ]);
    renderAdmin();
    expect(await screen.findByText("Nenhum documento enviado")).toBeInTheDocument();

    const input = screen.getByLabelText("Arquivo");
    await user.upload(input, new File(["x"], "planilha.xlsx"));
    expect(screen.getByRole("alert")).toHaveTextContent("Formato não suportado");

    await user.upload(input, new File(["pdf"], "guia.pdf", { type: "application/pdf" }));
    await user.selectOptions(screen.getByLabelText(/^Acesso/), "10");
    await user.click(screen.getByRole("button", { name: "Enviar documento" }));
    expect(knowledge.uploadDocument).toHaveBeenCalledWith(expect.any(File), 10);

    const list = await screen.findByRole("list", { name: "Documentos indexados" });
    expect(within(list).getByText("Processando")).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(4500);
    });
    expect(await within(list).findByText("Indexado")).toBeInTheDocument();
    expect(within(list).getByText(/12 trecho\(s\)/)).toBeInTheDocument();
  });

  it("cadastra e desativa regras de domínio", async () => {
    const user = userEvent.setup();
    knowledge.createRule.mockResolvedValue({ id: 1, rule: "Priorize segurança.", active: true });
    knowledge.updateRule.mockResolvedValue({ id: 1, rule: "Priorize segurança.", active: false });
    renderAdmin("/admin/conhecimento?aba=regras");
    expect(await screen.findByText("Nenhuma regra cadastrada")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Adicionar regra" }));
    expect(screen.getByText("Escreva a regra.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Texto da regra"), "Priorize segurança.");
    await user.click(screen.getByRole("button", { name: "Adicionar regra" }));
    expect(knowledge.createRule).toHaveBeenCalledWith("Priorize segurança.");

    await user.click(await screen.findByRole("switch"));
    expect(knowledge.updateRule).toHaveBeenCalledWith(1, { rule: "Priorize segurança.", active: false });
    expect(await screen.findByText("Inativa")).toBeInTheDocument();
  });

  it("cadastra termos de vocabulário com sinônimos e mantém os dados em caso de erro", async () => {
    const user = userEvent.setup();
    knowledge.createTerm
      .mockRejectedValueOnce(apiError(500))
      .mockResolvedValueOnce({ id: 1, term: "Sprint", definition: "Ciclo de 2 semanas", synonyms: ["iteração"] });
    renderAdmin("/admin/conhecimento?aba=vocabulario");
    await user.click(await screen.findByRole("button", { name: "Novo termo" }));
    const dialog = screen.getByRole("dialog", { name: "Novo termo" });
    await user.type(within(dialog).getByLabelText(/^Termo/), "Sprint");
    await user.type(within(dialog).getByLabelText(/^Definição/), "Ciclo de 2 semanas");
    await user.type(within(dialog).getByLabelText("Sinônimos"), "iteração{Enter}");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar termo" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O servidor encontrou um erro");
    expect(within(dialog).getByLabelText(/^Termo/)).toHaveValue("Sprint");

    await user.click(within(dialog).getByRole("button", { name: "Adicionar termo" }));
    expect(knowledge.createTerm).toHaveBeenLastCalledWith({ term: "Sprint", definition: "Ciclo de 2 semanas", synonyms: ["iteração"] });
    expect(await screen.findByRole("heading", { name: "Sprint" })).toBeInTheDocument();
  });

  it("informa quando o backend não oferece o recurso", async () => {
    knowledge.listDocuments.mockRejectedValue(apiError(404));
    renderAdmin();
    expect(await screen.findByText("Base de conhecimento indisponível")).toBeInTheDocument();
  });
});
