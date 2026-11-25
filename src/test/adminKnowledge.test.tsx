import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiError } from "./fixtures";

const auth = vi.hoisted(() => ({ user: null as null | { id: number; username: string; email: string; roles: string[] } }));
const knowledge = vi.hoisted(() => ({
  listDocuments: vi.fn(),
  uploadDocument: vi.fn(),
  deleteDocument: vi.fn(),
  listChunks: vi.fn(),
  getDomain: vi.fn(),
  saveDomain: vi.fn(),
}));

vi.mock("@/features/admin/services/knowledgeService", () => knowledge);
vi.mock("@/features/projects/services/projectService", () => ({
  listProjects: vi.fn().mockResolvedValue([
    { id: 10, name: "Sistema RAG", archived: false },
    { id: 11, name: "Portal", archived: false },
    { id: 12, name: "Antigo", archived: true },
  ]),
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
  knowledge.getDomain.mockResolvedValue({ rules: "Regra atual.", vocabulary: "" });
});
afterEach(() => vi.useRealTimers());

describe("Base de conhecimento", () => {
  it("bloqueia quem não é administrador", () => {
    auth.user = { ...ADMIN, roles: ["MEMBER"] };
    renderAdmin();
    expect(screen.getByText("Acesso negado")).toBeInTheDocument();
    expect(knowledge.listDocuments).not.toHaveBeenCalled();
  });

  it("indexa documentos por projeto, valida o arquivo e mostra os trechos", async () => {
    const user = userEvent.setup({ applyAccept: false });
    knowledge.uploadDocument.mockResolvedValue({ id: 1, fileName: "guia.pdf", type: "PDF", chunks: 12 });
    knowledge.listChunks.mockResolvedValue([{ ref: "D1-1", page: 1, excerpt: "Rotas exigem JWT." }]);
    renderAdmin();
    expect(await screen.findByText("Nenhum documento enviado")).toBeInTheDocument();
    expect(knowledge.listDocuments).toHaveBeenCalledWith(10);
    // Projetos arquivados não aparecem: o backend recusa a indexação neles.
    const projectSelect = screen.getByLabelText(/^Projeto/);
    expect(within(projectSelect).queryByText("Antigo")).not.toBeInTheDocument();

    const input = screen.getByLabelText("Arquivo");
    await user.upload(input, new File(["x"], "planilha.xlsx"));
    expect(screen.getByRole("alert")).toHaveTextContent("Formato não suportado");
    await user.upload(input, new File([new Uint8Array(5 * 1024 * 1024 + 1)], "grande.pdf"));
    expect(screen.getByRole("alert")).toHaveTextContent("excede o limite de 5.0 MB");

    await user.upload(input, new File(["pdf"], "guia.pdf", { type: "application/pdf" }));
    await user.click(screen.getByRole("button", { name: "Enviar documento" }));
    expect(knowledge.uploadDocument).toHaveBeenCalledWith(10, expect.any(File));
    expect(await screen.findByRole("status")).toHaveTextContent('"guia.pdf" indexado em 12 trecho(s).');

    const list = screen.getByRole("list", { name: "Documentos indexados" });
    expect(within(list).getByText(/PDF · 12 trecho\(s\)/)).toBeInTheDocument();
    await user.click(within(list).getByText("Ver trechos indexados"));
    expect(await within(list).findByText("Rotas exigem JWT.")).toBeInTheDocument();
    expect(knowledge.listChunks).toHaveBeenCalledWith(10, 1);
  });

  it("troca de projeto e mostra o erro do servidor ao indexar (ex.: IA desligada)", async () => {
    const user = userEvent.setup();
    knowledge.uploadDocument.mockRejectedValue(
      apiError(503, "Configure RAG_ENABLED e GEMINI_API_KEY para utilizar o provedor de IA."),
    );
    renderAdmin();
    await screen.findByText("Nenhum documento enviado");
    await user.selectOptions(screen.getByLabelText(/^Projeto/), "11");
    await waitFor(() => expect(knowledge.listDocuments).toHaveBeenLastCalledWith(11));
    await user.upload(screen.getByLabelText("Arquivo"), new File(["# a"], "regras.md"));
    await user.click(screen.getByRole("button", { name: "Enviar documento" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Configure RAG_ENABLED");
    expect(knowledge.uploadDocument).toHaveBeenCalledWith(11, expect.any(File));
  });

  it("edita regras de domínio e vocabulário", async () => {
    const user = userEvent.setup();
    knowledge.saveDomain.mockImplementation(async (input: object) => input);
    renderAdmin("/admin/conhecimento?aba=dominio");
    const rules = await screen.findByLabelText(/^Regras de domínio/);
    expect(rules).toHaveValue("Regra atual.");

    await user.clear(rules);
    await user.click(screen.getByRole("button", { name: "Salvar configuração" }));
    expect(screen.getByText("Escreva ao menos uma regra de domínio.")).toBeInTheDocument();
    expect(knowledge.saveDomain).not.toHaveBeenCalled();

    await user.type(rules, "Priorize segurança.");
    await user.type(screen.getByLabelText(/^Vocabulário/), "Sprint: duas semanas.");
    await user.click(screen.getByRole("button", { name: "Salvar configuração" }));
    expect(knowledge.saveDomain).toHaveBeenCalledWith({ rules: "Priorize segurança.", vocabulary: "Sprint: duas semanas." });
    expect(await screen.findByRole("status")).toHaveTextContent("Regras e vocabulário salvos.");
  });

  it("mantém o texto e mostra o erro quando salvar falha", async () => {
    const user = userEvent.setup();
    knowledge.saveDomain.mockRejectedValue(apiError(500));
    renderAdmin("/admin/conhecimento?aba=dominio");
    const rules = await screen.findByLabelText(/^Regras de domínio/);
    await user.type(rules, " Nova.");
    await user.click(screen.getByRole("button", { name: "Salvar configuração" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("O servidor encontrou um erro");
    expect(rules).toHaveValue("Regra atual. Nova.");
  });

  it("informa quando o projeto não oferece documentos", async () => {
    knowledge.listDocuments.mockRejectedValue(apiError(404));
    renderAdmin();
    expect(await screen.findByText("Base de conhecimento indisponível")).toBeInTheDocument();
  });
});
