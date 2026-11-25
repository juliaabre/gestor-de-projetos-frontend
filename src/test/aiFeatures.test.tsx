import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Task, TaskInput } from "@/features/tasks/types";
import { apiError, makeProject, makeTask } from "./fixtures";

const auth = vi.hoisted(() => ({
  user: { id: 1, username: "ana", email: "ana@ex.com", roles: ["MANAGER"] as string[] },
}));
const projectService = vi.hoisted(() => ({ getProject: vi.fn(), listProjects: vi.fn() }));
const taskService = vi.hoisted(() => ({
  listProjectTasks: vi.fn(),
  listColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  moveTask: vi.fn(),
  deleteTask: vi.fn(),
  listComments: vi.fn(),
  addComment: vi.fn(),
  listAttachments: vi.fn(),
  uploadAttachment: vi.fn(),
  downloadAttachment: vi.fn(),
  listHistory: vi.fn(),
}));
const aiService = vi.hoisted(() => ({
  recommendAssignees: vi.fn(),
  registerDecision: vi.fn(),
  askAssistant: vi.fn(),
  getConversation: vi.fn(),
  getSummary: vi.fn(),
  getBottlenecks: vi.fn(),
  generateDescription: vi.fn(),
  suggestDependencies: vi.fn(),
}));

vi.mock("@/features/projects/services/projectService", () => projectService);
vi.mock("@/features/tasks/services/taskService", () => taskService);
vi.mock("@/features/ai/services/aiService", () => aiService);
vi.mock("@/features/skills/services/skillService", () => ({ listUserSkills: vi.fn().mockResolvedValue([]) }));
vi.mock("@/features/auth/hooks/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, logout: vi.fn() }),
}));

import { ProjectBoardPage } from "@/features/projects/pages/ProjectBoardPage";

function renderPage(path = "/projects/10") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectBoardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const RECOMMENDATION = {
  recommendationId: 77,
  fallback: false,
  items: [
    {
      userId: 2, username: "bia", score: 92,
      justification: "Concluiu 5 tarefas com Spring Security.",
      skills: ["Spring Security", "JWT"], currentLoad: 2,
      sources: [{ type: "TASK", id: 12, title: "Login antigo", excerpt: null }],
    },
    { userId: 3, username: "caio", score: 61, justification: "Pouca experiência em segurança.", skills: [], currentLoad: 7, sources: [] },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 1, username: "ana", email: "ana@ex.com", roles: ["MANAGER"] };
  projectService.getProject.mockResolvedValue(makeProject());
  taskService.listProjectTasks.mockResolvedValue([
    makeTask(),
    makeTask({ id: 101, title: "Modelagem do banco", assigneeId: 3, status: "IN_PROGRESS" }),
  ]);
  taskService.listColumns.mockRejectedValue(apiError(404));
  taskService.listComments.mockResolvedValue([]);
  taskService.updateTask.mockImplementation(async (id: number, input: TaskInput) =>
    makeTask({ ...input, id, content: input.content ?? null } as Partial<Task>),
  );
  aiService.recommendAssignees.mockResolvedValue(RECOMMENDATION);
  aiService.registerDecision.mockResolvedValue(undefined);
  aiService.getConversation.mockRejectedValue(apiError(404));
  aiService.getSummary.mockResolvedValue({ summary: "Projeto 40% concluído.", sources: [] });
  aiService.getBottlenecks.mockResolvedValue([]);
});

async function openRecommendation() {
  const user = userEvent.setup();
  renderPage();
  const card = await screen.findByRole("article", { name: "Autenticação JWT" });
  await user.click(within(card).getByRole("button", { name: 'Sugerir responsável para "Autenticação JWT"' }));
  const dialog = screen.getByRole("dialog", { name: "Recomendação de responsável" });
  return { user, dialog };
}

describe("Recomendação de responsáveis", () => {
  it("mostra 'Sugerir' só em tarefas sem responsável e apenas para quem decide", async () => {
    renderPage();
    const card = await screen.findByRole("article", { name: "Autenticação JWT" });
    expect(within(card).getByRole("button", { name: /Sugerir responsável/ })).toBeInTheDocument();
    const assigned = screen.getByRole("article", { name: "Modelagem do banco" });
    expect(within(assigned).queryByRole("button", { name: /Sugerir/ })).not.toBeInTheDocument();
  });

  it("esconde 'Sugerir' para integrantes sem papel de gerente", async () => {
    projectService.getProject.mockResolvedValue(makeProject({ canManage: false, myRole: "MEMBER" }));
    renderPage();
    const card = await screen.findByRole("article", { name: "Autenticação JWT" });
    expect(within(card).queryByRole("button", { name: /Sugerir/ })).not.toBeInTheDocument();
  });

  it("exibe ranking com percentual, justificativa, competências e carga; aceitar atribui e registra", async () => {
    const { user, dialog } = await openRecommendation();
    const ranking = await within(dialog).findByRole("group", { name: /Recomendados para esta tarefa/ });
    expect(within(ranking).getByText("92%")).toBeInTheDocument();
    expect(within(ranking).getByText("Concluiu 5 tarefas com Spring Security.")).toBeInTheDocument();
    expect(within(ranking).getByText("JWT")).toBeInTheDocument();
    expect(within(ranking).getByText("Carga atual: 7 tarefa(s)")).toBeInTheDocument();
    expect(taskService.updateTask).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Atribuir a bia" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(taskService.updateTask).toHaveBeenCalledWith(100, expect.objectContaining({ assigneeId: 2, title: "Autenticação JWT" }));
    expect(aiService.registerDecision).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: 100, recommendationId: 77, decision: "ACCEPTED", recommendedUserId: 2, chosenUserId: 2 }),
    );
    expect(screen.getByRole("status")).toHaveTextContent('"Autenticação JWT" atribuída a bia.');
  });

  it("registra ajuste quando o gerente escolhe outro integrante", async () => {
    const { user, dialog } = await openRecommendation();
    await user.click(await within(dialog).findByRole("radio", { name: /caio/ }));
    await user.click(within(dialog).getByRole("button", { name: "Atribuir a caio" }));
    await waitFor(() =>
      expect(aiService.registerDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "ADJUSTED", recommendedUserId: 2, chosenUserId: 3 }),
      ),
    );
    expect(taskService.updateTask).toHaveBeenCalledWith(100, expect.objectContaining({ assigneeId: 3 }));
  });

  it("recusar registra a decisão sem atribuir ninguém", async () => {
    const { user, dialog } = await openRecommendation();
    await user.click(await within(dialog).findByRole("button", { name: "Recusar" }));
    await user.type(within(dialog).getByLabelText(/Motivo da recusa/), "Prefiro dividir");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar recusa" }));
    await waitFor(() =>
      expect(aiService.registerDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "REJECTED", chosenUserId: null, reason: "Prefiro dividir" }),
      ),
    );
    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("com a IA indisponível, informa e permite atribuição manual", async () => {
    aiService.recommendAssignees.mockRejectedValue(apiError(503));
    const { user, dialog } = await openRecommendation();
    expect(await within(dialog).findByText(/recomendação por IA está indisponível/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/%$/)).not.toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole("combobox"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Atribuir a caio" }));
    await waitFor(() => expect(taskService.updateTask).toHaveBeenCalledWith(100, expect.objectContaining({ assigneeId: 3 })));
    expect(aiService.registerDecision).not.toHaveBeenCalled();
  });
});

describe("Assistente e resumo", () => {
  it("responde com fontes e gargalos, e bloqueia envio duplicado", async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    aiService.askAssistant.mockImplementation(() => new Promise((r) => (resolve = r)));
    renderPage("/projects/10?aba=assistente");

    const panel = await screen.findByRole("region", { name: /Assistente do projeto/ });
    expect(await within(panel).findByText(/histórico não é salvo/)).toBeInTheDocument();
    await user.type(within(panel).getByLabelText("Pergunta para o assistente"), "Quem está sobrecarregado?");
    await user.click(within(panel).getByRole("button", { name: "Enviar" }));

    const sending = within(panel).getByRole("button", { name: "Aguardando..." });
    expect(sending).toBeDisabled();
    await user.type(within(panel).getByLabelText("Pergunta para o assistente"), "De novo{Enter}");
    expect(aiService.askAssistant).toHaveBeenCalledTimes(1);

    resolve({
      id: "1",
      question: "Quem está sobrecarregado?",
      answer: "caio tem 7 tarefas ativas.",
      sources: [
        { type: "TASK", id: 101, title: "Modelagem do banco", excerpt: null },
        { type: "DOCUMENT", id: 5, title: "Guia de API.pdf", excerpt: null },
      ],
      bottlenecks: [
        { kind: "OVERLOADED_MEMBER", severity: "HIGH", description: "caio tem o dobro da média.", tasks: [], members: [{ id: 3, username: "caio" }] },
      ],
    });

    expect(await within(panel).findByText("caio tem 7 tarefas ativas.")).toBeInTheDocument();
    const sources = within(panel).getByRole("list", { name: "Fontes citadas" });
    expect(within(sources).getByText("Guia de API.pdf")).toBeInTheDocument();
    expect(within(panel).getByRole("note")).toHaveTextContent("Integrante sobrecarregado");

    await user.click(within(sources).getByRole("button", { name: /Modelagem do banco/ }));
    expect(screen.getByRole("dialog", { name: "Modelagem do banco" })).toBeInTheDocument();
  });

  it("não perde a pergunta enviada enquanto o histórico ainda carrega", async () => {
    const user = userEvent.setup();
    let resolveHistory!: (value: unknown) => void;
    aiService.getConversation.mockImplementation(() => new Promise((r) => (resolveHistory = r)));
    aiService.askAssistant.mockResolvedValue({ id: "2", question: "Nova", answer: "Resposta nova.", sources: [], bottlenecks: [] });
    renderPage("/projects/10?aba=assistente");
    const panel = await screen.findByRole("region", { name: /Assistente do projeto/ });

    await user.type(within(panel).getByLabelText("Pergunta para o assistente"), "Nova{Enter}");
    resolveHistory([{ id: "1", question: "Antiga", answer: "Resposta antiga.", sources: [], bottlenecks: [] }]);

    expect(await within(panel).findByText("Resposta nova.")).toBeInTheDocument();
    expect(within(panel).getByText("Resposta antiga.")).toBeInTheDocument();
  });

  it("não inventa resposta quando a API falha", async () => {
    const user = userEvent.setup();
    aiService.askAssistant.mockRejectedValue(apiError(500));
    renderPage("/projects/10?aba=assistente");
    const panel = await screen.findByRole("region", { name: /Assistente do projeto/ });
    await user.type(within(panel).getByLabelText("Pergunta para o assistente"), "Status?{Enter}");
    expect(await within(panel).findByRole("alert")).toHaveTextContent("O servidor encontrou um erro");
    expect(within(panel).queryByRole("list", { name: "Fontes citadas" })).not.toBeInTheDocument();
  });

  it("diferencia 'sem gargalos' de falha na consulta", async () => {
    renderPage("/projects/10?aba=assistente");
    expect(await screen.findByText(/Nenhum gargalo identificado/)).toBeInTheDocument();
    expect(screen.getByText("Projeto 40% concluído.")).toBeInTheDocument();
  });

  it("mostra falha ao consultar gargalos e permite atualizar o resumo", async () => {
    const user = userEvent.setup();
    aiService.getBottlenecks.mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce([
      { kind: "STALLED_TASK", severity: "MEDIUM", description: "Parada há 9 dias.", tasks: [{ id: 101, title: "Modelagem do banco" }], members: [] },
    ]);
    renderPage("/projects/10?aba=assistente");
    expect(await screen.findByText("Falha ao consultar gargalos.")).toBeInTheDocument();
    expect(screen.queryByText(/Nenhum gargalo identificado/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("Parada há 9 dias.")).toBeInTheDocument();
    expect(aiService.getSummary).toHaveBeenLastCalledWith(10, "PROJECT", true);
  });

  it("comunica IA indisponível no resumo sem bloquear o quadro", async () => {
    const user = userEvent.setup();
    aiService.getSummary.mockRejectedValue(apiError(503));
    aiService.getBottlenecks.mockRejectedValue(apiError(503));
    renderPage("/projects/10?aba=assistente");
    expect(await screen.findByText(/resumo por IA está indisponível/)).toBeInTheDocument();
    expect(screen.getByText(/Não é possível afirmar que não há gargalos/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Quadro/ }));
    expect(await screen.findByRole("article", { name: "Autenticação JWT" })).toBeInTheDocument();
  });
});

describe("Geração de descrição e dependências", () => {
  it("só aplica a descrição gerada após aceitar, e descartar mantém o texto", async () => {
    const user = userEvent.setup();
    aiService.generateDescription.mockResolvedValue({ description: "Descrição sugerida.", justification: null, sources: [] });
    renderPage();
    await screen.findByRole("article", { name: "Autenticação JWT" });
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    const dialog = screen.getByRole("dialog", { name: "Nova tarefa" });

    await user.click(within(dialog).getByRole("button", { name: "Gerar descrição" }));
    expect(within(dialog).getByText("Informe o título para gerar uma descrição.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/^Título/), "Cadastro de livros");
    await user.click(within(dialog).getByRole("button", { name: "Gerar descrição" }));
    const review = await within(dialog).findByRole("region", { name: "Sugestão de descrição" });
    expect(within(dialog).getByLabelText(/^Descrição/)).toHaveValue("");

    await user.click(within(review).getByRole("button", { name: "Descartar" }));
    expect(within(dialog).getByLabelText(/^Descrição/)).toHaveValue("");

    await user.click(within(dialog).getByRole("button", { name: "Gerar descrição" }));
    const again = await within(dialog).findByRole("region", { name: "Sugestão de descrição" });
    await user.click(within(again).getByRole("button", { name: "Editar" }));
    await user.type(within(again).getByLabelText("Editar sugestão"), " Revisada.");
    await user.click(within(again).getByRole("button", { name: "Aceitar" }));
    expect(within(dialog).getByLabelText(/^Descrição/)).toHaveValue("Descrição sugerida. Revisada.");
    expect(taskService.createTask).not.toHaveBeenCalled();
  });

  it("formulário segue utilizável com a geração indisponível", async () => {
    const user = userEvent.setup();
    aiService.generateDescription.mockRejectedValue(apiError(503));
    renderPage();
    await screen.findByRole("article", { name: "Autenticação JWT" });
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    const dialog = screen.getByRole("dialog", { name: "Nova tarefa" });
    await user.type(within(dialog).getByLabelText(/^Título/), "X");
    await user.click(within(dialog).getByRole("button", { name: "Gerar descrição" }));
    expect(await within(dialog).findByText(/escrever a descrição manualmente/)).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/^Descrição/), "Manual");
    expect(within(dialog).getByLabelText(/^Descrição/)).toHaveValue("Manual");
  });

  it("dependências sugeridas não aparecem como confirmadas até serem registradas", async () => {
    const user = userEvent.setup();
    aiService.suggestDependencies.mockResolvedValue([
      { taskId: 101, title: null, justification: "Precisa do banco modelado.", confidence: 80 },
      { taskId: 100, title: "ela mesma", justification: "", confidence: null },
    ]);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Autenticação JWT" }));
    const dialog = screen.getByRole("dialog", { name: "Autenticação JWT" });

    await user.click(within(dialog).getByRole("button", { name: "Sugerir dependências com IA" }));
    const suggestions = await within(dialog).findByRole("list", { name: "Dependências sugeridas" });
    expect(within(suggestions).getAllByRole("listitem")).toHaveLength(1);
    expect(within(suggestions).getByText("Modelagem do banco")).toBeInTheDocument();
    expect(within(dialog).queryByRole("list", { name: "Depende de" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Registrar selecionadas (0)" })).toBeDisabled();

    await user.click(within(suggestions).getByRole("checkbox"));
    await user.click(within(dialog).getByRole("button", { name: "Registrar selecionadas (1)" }));

    await waitFor(() =>
      expect(taskService.updateTask).toHaveBeenCalledWith(100, expect.objectContaining({ dependencyIds: [101] })),
    );
    const confirmed = await within(screen.getByRole("dialog", { name: "Autenticação JWT" })).findByRole("list", { name: "Depende de" });
    expect(within(confirmed).getByText("Modelagem do banco")).toBeInTheDocument();
  });
});
