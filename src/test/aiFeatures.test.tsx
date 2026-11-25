import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { Task, TaskInput } from "@/features/tasks/types";
import { apiError, makeProject, makeTask, dependenciesFrom } from "./fixtures";

const auth = vi.hoisted(() => ({
  user: { id: 1, username: "ana", email: "ana@ex.com", roles: ["MANAGER"] as string[] },
}));
const projectService = vi.hoisted(() => ({ getProject: vi.fn(), listProjects: vi.fn() }));
const taskService = vi.hoisted(() => ({
  listProjectTasks: vi.fn(),
  listDependencies: vi.fn(),
  setDependencies: vi.fn(),
  getTask: vi.fn(),
  deleteAttachment: vi.fn(),
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
  notice: null,
  decision: null,
  chosenUserId: null,
  items: [
    {
      userId: 2, username: null, score: 92,
      justification: "Aderência tecnológica: 100%. No projeto: 5 conclusões no histórico, 2 tarefas abertas.",
      sources: [{ ref: "T12", type: "TASK", id: 12, title: "Login antigo", excerpt: null, page: null }],
    },
    { userId: 3, username: null, score: 61, justification: "Aderência tecnológica: 0%.", sources: [] },
  ],
};

const answer = (text: string, extra: object = {}) => ({ text, sources: [], fallback: false, notice: null, ...extra });

beforeEach(() => {
  vi.clearAllMocks();
  taskService.listDependencies.mockImplementation(dependenciesFrom(taskService.listProjectTasks));
  window.sessionStorage.clear();
  auth.user = { id: 1, username: "ana", email: "ana@ex.com", roles: ["MEMBER"] };
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
  aiService.registerDecision.mockResolvedValue({ ...RECOMMENDATION, decision: "ACCEPTED", chosenUserId: 2 });
  taskService.getTask.mockImplementation(async (id: number) => makeTask({ id, assigneeId: 2 }));
  aiService.getSummary.mockResolvedValue(answer("Projeto 40% concluído."));
  aiService.getBottlenecks.mockResolvedValue(answer("Nenhum gargalo identificado [G1]."));
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
  it("mostra 'Sugerir' só em tarefas sem responsável e apenas para o gerente do projeto", async () => {
    renderPage();
    const card = await screen.findByRole("article", { name: "Autenticação JWT" });
    expect(within(card).getByRole("button", { name: /Sugerir responsável/ })).toBeInTheDocument();
    const assigned = screen.getByRole("article", { name: "Modelagem do banco" });
    expect(within(assigned).queryByRole("button", { name: /Sugerir/ })).not.toBeInTheDocument();
  });

  it("esconde 'Sugerir' para integrantes que não são o gerente", async () => {
    projectService.getProject.mockResolvedValue(makeProject({ canManage: false, myRole: "MEMBER" }));
    renderPage();
    const card = await screen.findByRole("article", { name: "Autenticação JWT" });
    expect(within(card).queryByRole("button", { name: /Sugerir/ })).not.toBeInTheDocument();
  });

  it("exibe ranking com percentual, nome da equipe e justificativa; aceitar registra ACEITA e o servidor atribui", async () => {
    const { user, dialog } = await openRecommendation();
    const ranking = await within(dialog).findByRole("group", { name: /Recomendados para esta tarefa/ });
    expect(within(ranking).getByText("92%")).toBeInTheDocument();
    expect(within(ranking).getByText("bia")).toBeInTheDocument();
    expect(within(ranking).getByText(/5 conclusões no histórico/)).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Atribuir a bia" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(aiService.registerDecision).toHaveBeenCalledWith({
      taskId: 100, recommendationId: 77, decision: "ACCEPTED", chosenUserId: 2,
    });
    expect(taskService.updateTask).not.toHaveBeenCalled();
    expect(taskService.getTask).toHaveBeenCalledWith(100);
    expect(screen.getByRole("status")).toHaveTextContent('"Autenticação JWT" atribuída a bia.');
  });

  it("mostra o aviso do servidor quando o ranking vem sem síntese do modelo", async () => {
    aiService.recommendAssignees.mockResolvedValue({ ...RECOMMENDATION, fallback: true, notice: "Resposta extrativa; confirme os dados nas fontes." });
    const { dialog } = await openRecommendation();
    expect(await within(dialog).findByRole("note")).toHaveTextContent("Resposta extrativa");
  });

  it("avisa quando o servidor não atribui o responsável escolhido", async () => {
    taskService.getTask.mockImplementation(async (id: number) => makeTask({ id, assigneeId: null }));
    const { user, dialog } = await openRecommendation();
    await user.click(await within(dialog).findByRole("button", { name: "Atribuir a bia" }));
    expect(await screen.findByRole("alert")).toHaveTextContent('O servidor não gravou o responsável de "Autenticação JWT"');
  });

  it("registra AJUSTADA quando o gerente escolhe outro integrante", async () => {
    taskService.getTask.mockImplementation(async (id: number) => makeTask({ id, assigneeId: 3 }));
    const { user, dialog } = await openRecommendation();
    await user.click(await within(dialog).findByRole("radio", { name: /caio/ }));
    await user.click(within(dialog).getByRole("button", { name: "Atribuir a caio" }));
    await waitFor(() =>
      expect(aiService.registerDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "ADJUSTED", chosenUserId: 3 }),
      ),
    );
    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("recusar registra RECUSADA com a observação, sem atribuir ninguém", async () => {
    const { user, dialog } = await openRecommendation();
    await user.click(await within(dialog).findByRole("button", { name: "Recusar" }));
    await user.type(within(dialog).getByLabelText(/Motivo da recusa/), "Prefiro dividir");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar recusa" }));
    await waitFor(() =>
      expect(aiService.registerDecision).toHaveBeenCalledWith(
        expect.objectContaining({ decision: "REJECTED", note: "Prefiro dividir" }),
      ),
    );
    expect(taskService.updateTask).not.toHaveBeenCalled();
    expect(taskService.getTask).not.toHaveBeenCalled();
  });

  it("com a IA indisponível, informa e permite atribuição manual pela edição da tarefa", async () => {
    aiService.recommendAssignees.mockRejectedValue(apiError(503));
    const { user, dialog } = await openRecommendation();
    expect(await within(dialog).findByText(/recomendação por IA está indisponível/)).toBeInTheDocument();
    await user.selectOptions(within(dialog).getByRole("combobox"), "3");
    await user.click(within(dialog).getByRole("button", { name: "Atribuir a caio" }));
    await waitFor(() => expect(taskService.updateTask).toHaveBeenCalledWith(100, expect.objectContaining({ assigneeId: 3 })));
    expect(aiService.registerDecision).not.toHaveBeenCalled();
  });
});

describe("Assistente e resumo", () => {
  it("responde com fontes e aviso de resposta alternativa, e bloqueia envio duplicado", async () => {
    const user = userEvent.setup();
    let resolve!: (value: unknown) => void;
    aiService.askAssistant.mockImplementation(() => new Promise((r) => (resolve = r)));
    renderPage("/projects/10?aba=assistente");

    const panel = await screen.findByRole("region", { name: /Assistente do projeto/ });
    expect(within(panel).getByText(/salva só nesta aba/)).toBeInTheDocument();
    await user.type(within(panel).getByLabelText("Pergunta para o assistente"), "Quem está sobrecarregado?");
    await user.click(within(panel).getByRole("button", { name: "Enviar" }));

    const sending = within(panel).getByRole("button", { name: "Aguardando..." });
    expect(sending).toBeDisabled();
    await user.type(within(panel).getByLabelText("Pergunta para o assistente"), "De novo{Enter}");
    expect(aiService.askAssistant).toHaveBeenCalledTimes(1);
    expect(aiService.askAssistant).toHaveBeenCalledWith(10, "Quem está sobrecarregado?", expect.anything());

    resolve({
      id: "1",
      question: "Quem está sobrecarregado?",
      text: "caio tem 7 tarefas ativas [T101].",
      sources: [
        { ref: "T101", type: "TASK", id: 101, title: "Modelagem do banco", excerpt: null, page: null },
        { ref: "D5-1", type: "DOCUMENT", id: 5, title: "Guia de API.pdf", excerpt: "Trecho", page: 3 },
      ],
      fallback: true,
      notice: "Resposta extrativa; confirme os dados nas fontes.",
    });

    expect(await within(panel).findByText("caio tem 7 tarefas ativas [T101].")).toBeInTheDocument();
    const sources = within(panel).getByRole("list", { name: "Fontes citadas" });
    expect(within(sources).getByText("Guia de API.pdf · p. 3")).toBeInTheDocument();
    expect(within(panel).getByRole("note")).toHaveTextContent("Resposta extrativa");

    await user.click(within(sources).getByRole("button", { name: /Modelagem do banco/ }));
    expect(screen.getByRole("dialog", { name: "Modelagem do banco" })).toBeInTheDocument();
  });

  it("lembra a conversa nesta aba ao voltar para o assistente", async () => {
    const user = userEvent.setup();
    aiService.askAssistant.mockResolvedValue({ ...answer("Resposta guardada."), id: "2", question: "Status?" });
    const { unmount } = renderPage("/projects/10?aba=assistente");
    const panel = await screen.findByRole("region", { name: /Assistente do projeto/ });
    await user.type(within(panel).getByLabelText("Pergunta para o assistente"), "Status?{Enter}");
    expect(await within(panel).findByText("Resposta guardada.")).toBeInTheDocument();
    unmount();

    renderPage("/projects/10?aba=assistente");
    expect(await screen.findByText("Resposta guardada.")).toBeInTheDocument();
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

  it("gerente vê resumo e gargalos; membro vê só o assistente", async () => {
    const { unmount } = renderPage("/projects/10?aba=assistente");
    expect(await screen.findByText("Projeto 40% concluído.")).toBeInTheDocument();
    expect(screen.getByText("Nenhum gargalo identificado [G1].")).toBeInTheDocument();
    unmount();

    vi.clearAllMocks();
    projectService.getProject.mockResolvedValue(makeProject({ canManage: false, myRole: "MEMBER" }));
    renderPage("/projects/10?aba=assistente");
    expect(await screen.findByRole("region", { name: /Assistente do projeto/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Resumo do andamento/ })).not.toBeInTheDocument();
    expect(aiService.getSummary).not.toHaveBeenCalled();
  });

  it("filtra o resumo por período e valida as datas", async () => {
    const user = userEvent.setup();
    renderPage("/projects/10?aba=assistente");
    await screen.findByText("Projeto 40% concluído.");
    await user.type(screen.getByLabelText("Prazo a partir de"), "2026-12-10");
    await user.click(screen.getByRole("button", { name: "Aplicar período" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Informe as duas datas do período");

    await user.type(screen.getByLabelText("Prazo até"), "2026-12-01");
    await user.click(screen.getByRole("button", { name: "Aplicar período" }));
    expect(screen.getByRole("alert")).toHaveTextContent("A data inicial deve ser anterior à final.");

    await user.clear(screen.getByLabelText("Prazo até"));
    await user.type(screen.getByLabelText("Prazo até"), "2026-12-31");
    await user.click(screen.getByRole("button", { name: "Aplicar período" }));
    await waitFor(() =>
      expect(aiService.getSummary).toHaveBeenLastCalledWith(10, { start: "2026-12-10", end: "2026-12-31" }),
    );
  });

  it("mostra falha ao consultar gargalos e permite atualizar", async () => {
    const user = userEvent.setup();
    aiService.getBottlenecks.mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce(answer("Parada há 9 dias [T101]."));
    renderPage("/projects/10?aba=assistente");
    expect(await screen.findByText("Falha ao consultar gargalos.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atualizar" }));
    expect(await screen.findByText("Parada há 9 dias [T101].")).toBeInTheDocument();
  });

  it("comunica IA indisponível no resumo sem bloquear o quadro", async () => {
    const user = userEvent.setup();
    aiService.getSummary.mockRejectedValue(apiError(503));
    aiService.getBottlenecks.mockRejectedValue(apiError(503));
    renderPage("/projects/10?aba=assistente");
    expect(await screen.findByText(/resumo por IA está indisponível/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: /Quadro/ }));
    expect(await screen.findByRole("article", { name: "Autenticação JWT" })).toBeInTheDocument();
  });
});

describe("Geração de descrição e dependências", () => {
  async function openEdit(user: ReturnType<typeof userEvent.setup>) {
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Autenticação JWT" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Editar" }));
    return screen.getByRole("dialog", { name: "Editar tarefa" });
  }

  it("em tarefa nova, explica que a geração exige salvar antes", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("article", { name: "Autenticação JWT" });
    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    const dialog = screen.getByRole("dialog", { name: "Nova tarefa" });
    expect(within(dialog).getByText(/depois que a tarefa é salva/)).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: /Gerar descrição|Refinar/ })).not.toBeInTheDocument();
  });

  it("só aplica a descrição gerada após aceitar, e descartar mantém o texto", async () => {
    const user = userEvent.setup();
    aiService.generateDescription.mockResolvedValue(answer("Descrição sugerida."));
    const dialog = await openEdit(user);
    const description = within(dialog).getByLabelText(/^Descrição/);
    const original = (description as HTMLTextAreaElement).value;

    await user.type(within(dialog).getByLabelText(/Instrução para a IA/), "Mais objetiva");
    await user.click(within(dialog).getByRole("button", { name: "Refinar descrição" }));
    const review = await within(dialog).findByRole("region", { name: "Sugestão de descrição" });
    expect(aiService.generateDescription).toHaveBeenCalledWith(100, expect.stringContaining("Instrução: Mais objetiva"));
    expect(aiService.generateDescription.mock.calls[0][1]).toContain('Refine a descrição da tarefa "Autenticação JWT"');
    expect(description).toHaveValue(original);

    await user.click(within(review).getByRole("button", { name: "Descartar" }));
    expect(description).toHaveValue(original);

    await user.click(within(dialog).getByRole("button", { name: "Refinar descrição" }));
    const again = await within(dialog).findByRole("region", { name: "Sugestão de descrição" });
    await user.click(within(again).getByRole("button", { name: "Editar" }));
    await user.type(within(again).getByLabelText("Editar sugestão"), " Revisada.");
    await user.click(within(again).getByRole("button", { name: "Aceitar" }));
    expect(description).toHaveValue("Descrição sugerida. Revisada.");
    expect(taskService.updateTask).not.toHaveBeenCalled();
  });

  it("formulário segue utilizável com a geração indisponível", async () => {
    const user = userEvent.setup();
    aiService.generateDescription.mockRejectedValue(apiError(503));
    const dialog = await openEdit(user);
    await user.click(within(dialog).getByRole("button", { name: "Refinar descrição" }));
    expect(await within(dialog).findByText(/escrever a descrição manualmente/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText(/^Descrição/));
    await user.type(within(dialog).getByLabelText(/^Descrição/), "Manual");
    expect(within(dialog).getByLabelText(/^Descrição/)).toHaveValue("Manual");
  });

  it("tarefas citadas como dependências só são registradas após seleção", async () => {
    const user = userEvent.setup();
    aiService.suggestDependencies.mockResolvedValue({
      answer: answer("Depende da modelagem [T101]."),
      suggestions: [
        { taskId: 101, title: "Modelagem do banco", justification: "Tarefa 101: Modelagem do banco.", confidence: null },
        { taskId: 999, title: "Inexistente", justification: "", confidence: null },
      ],
    });
    taskService.updateTask.mockImplementation(async (id: number, input: TaskInput) =>
      makeTask({ ...input, id, content: input.content ?? null } as Partial<Task>),
    );
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Autenticação JWT" }));
    const dialog = screen.getByRole("dialog", { name: "Autenticação JWT" });

    await user.click(within(dialog).getByRole("button", { name: "Sugerir dependências com IA" }));
    const suggestions = await within(dialog).findByRole("list", { name: "Dependências sugeridas" });
    expect(within(suggestions).getAllByRole("listitem")).toHaveLength(1);
    expect(within(suggestions).getByText("Modelagem do banco")).toBeInTheDocument();
    expect(within(dialog).getByText("Depende da modelagem [T101].")).toBeInTheDocument();
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
