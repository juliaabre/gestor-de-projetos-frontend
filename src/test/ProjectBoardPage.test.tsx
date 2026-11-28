import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import type { Project } from "@/features/projects/types";
import type { Task, TaskInput } from "@/features/tasks/types";

const projectService = vi.hoisted(() => ({ getProject: vi.fn() }));
const taskService = vi.hoisted(() => ({
  listProjectTasks: vi.fn(),
  listDependencies: vi.fn(),
  setDependencies: vi.fn(),
  getTask: vi.fn(),
  deleteAttachment: vi.fn(),
  listColumns: vi.fn(),
  createColumn: vi.fn(),
  updateColumn: vi.fn(),
  reorderColumns: vi.fn(),
  deleteColumn: vi.fn(),
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
const skillService = vi.hoisted(() => ({
  listUserSkills: vi.fn(),
  createSkill: vi.fn(),
  updateSkill: vi.fn(),
  deleteSkill: vi.fn(),
}));

vi.mock("@/features/projects/services/projectService", () => projectService);
vi.mock("@/features/tasks/services/taskService", () => taskService);
vi.mock("@/features/skills/services/skillService", () => skillService);
vi.mock("@/features/auth/hooks/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "ana", email: "ana@ex.com", roles: ["MEMBER"] },
    logout: vi.fn(),
  }),
}));

import { ProjectBoardPage } from "@/features/projects/pages/ProjectBoardPage";
import { dependenciesFrom } from "./fixtures";

function apiError(status: number, message?: string) {
  const headers = new AxiosHeaders();
  return new AxiosError("error", String(status), { headers }, null, {
    status,
    statusText: "",
    headers: {},
    config: { headers },
    data: message ? { status, mensagem: message } : "",
  });
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 10,
    name: "Sistema RAG",
    description: "Plataforma com IA",
    archived: false,
    creatorId: 1,
    managerId: 1,
    team: [
      { id: 1, username: "ana", email: "ana@ex.com" },
      { id: 2, username: "bia", email: "bia@ex.com" },
    ],
    teamIds: [1, 2],
    taskIds: [],
    myRole: "MANAGER",
    canManage: true,
    canAddMembers: true,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 100,
    title: "Tela de login",
    content: "Formulário com validação",
    requirements: null,
    technologies: ["React", "Zod"],
    status: "TODO",
    priority: "HIGH",
    complexity: 3,
    dueDate: null,
    assigneeId: 2,
    dependencyIds: [],
    projectId: 10,
    ...overrides,
  };
}

function renderPage(path = "/projects/10") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/projects/:projectId" element={<ProjectBoardPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const column = (name: string) => screen.getByRole("region", { name: "Quadro Kanban" }).querySelector(
  `section[data-status="${name}"]`,
) as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  taskService.listDependencies.mockImplementation(dependenciesFrom(taskService.listProjectTasks));
  projectService.getProject.mockResolvedValue(makeProject());
  taskService.listProjectTasks.mockResolvedValue([
    makeTask(),
    makeTask({ id: 101, title: "API de tarefas", status: "IN_PROGRESS", assigneeId: null, technologies: [] }),
  ]);
  taskService.listColumns.mockRejectedValue(apiError(404));
  taskService.listComments.mockResolvedValue([]);
  taskService.listAttachments.mockResolvedValue([]);
  taskService.listHistory.mockRejectedValue(apiError(404));
  skillService.listUserSkills.mockResolvedValue([]);
});

describe("ProjectBoardPage — quadro", () => {
  it("exibe as colunas padrão e cada tarefa na coluna do seu status", async () => {
    renderPage();
    expect(screen.getByText("Carregando quadro...")).toBeInTheDocument();
    const card = await screen.findByRole("article", { name: "Tela de login" });

    expect(within(column("TODO")).getByRole("article", { name: "Tela de login" })).toBe(card);
    expect(within(column("IN_PROGRESS")).getByRole("article", { name: "API de tarefas" })).toBeInTheDocument();
    expect(within(column("DONE")).getByText(/Nenhuma tarefa/)).toBeInTheDocument();

    expect(within(card).getByText("Prioridade Alta")).toBeInTheDocument();
    expect(within(card).getByText("Complexidade 3/5 · Média")).toBeInTheDocument();
    expect(within(card).getByText("React")).toBeInTheDocument();
    expect(within(card).getByText("bia")).toBeInTheDocument();
  });

  it("usa colunas personalizadas devolvidas pela API", async () => {
    taskService.listColumns.mockResolvedValue([
      { id: 1, name: "A fazer", status: "TODO", order: 0, custom: false },
      { id: 2, name: "Em revisão", status: "EM_REVISAO", order: 1, custom: true },
    ]);
    taskService.listProjectTasks.mockResolvedValue([makeTask({ status: "EM_REVISAO" })]);
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    expect(within(column("EM_REVISAO")).getByRole("article", { name: "Tela de login" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar coluna Em revisão" })).toBeInTheDocument();
  });

  it("move pela alternativa acessível e persiste o novo status", async () => {
    const user = userEvent.setup();
    taskService.moveTask.mockImplementation(async (task: Task, status: string) => ({ ...task, status }));
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });

    await user.selectOptions(screen.getByRole("combobox", { name: 'Mover "Tela de login" para' }), "DONE");

    expect(taskService.moveTask).toHaveBeenCalledWith(expect.objectContaining({ id: 100, status: "TODO" }), "DONE");
    expect(await screen.findByRole("status")).toHaveTextContent('"Tela de login" movida para Concluído.');
    expect(within(column("DONE")).getByRole("article", { name: "Tela de login" })).toBeInTheDocument();
  });

  it("devolve a tarefa à coluna original e informa o erro se a API falhar", async () => {
    const user = userEvent.setup();
    taskService.moveTask.mockRejectedValue(apiError(403, "Sem permissão."));
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });

    await user.selectOptions(screen.getByRole("combobox", { name: 'Mover "Tela de login" para' }), "DONE");

    expect(await screen.findByRole("alert")).toHaveTextContent("Não foi possível mover \"Tela de login\": Sem permissão.");
    expect(within(column("TODO")).getByRole("article", { name: "Tela de login" })).toBeInTheDocument();
    expect(within(column("DONE")).queryByRole("article")).not.toBeInTheDocument();
  });

  it("cria tarefa validando o formulário e mantém os dados quando a API falha", async () => {
    const user = userEvent.setup();
    taskService.createTask
      .mockRejectedValueOnce(apiError(500))
      .mockImplementationOnce(async (input: TaskInput) => makeTask({ ...input, id: 200, content: input.content ?? null }));
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });

    await user.click(screen.getByRole("button", { name: "Nova tarefa" }));
    const dialog = screen.getByRole("dialog", { name: "Nova tarefa" });
    await user.click(within(dialog).getByRole("button", { name: "Criar tarefa" }));
    expect(await within(dialog).findByText("Informe o título da tarefa.")).toBeInTheDocument();
    expect(taskService.createTask).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/^Título/), "Deploy");
    await user.type(within(dialog).getByLabelText("Tecnologias"), "Docker{Enter}");
    await user.selectOptions(within(dialog).getByLabelText("Responsável"), "1");
    await user.selectOptions(within(dialog).getByLabelText("Complexidade"), "4");
    await user.click(within(dialog).getByRole("checkbox", { name: /API de tarefas/ }));
    await user.click(within(dialog).getByRole("button", { name: "Criar tarefa" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O servidor encontrou um erro");
    expect(within(dialog).getByLabelText(/^Título/)).toHaveValue("Deploy");
    expect(within(dialog).getByText("Docker")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Criar tarefa" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(taskService.createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({
        title: "Deploy",
        technologies: ["Docker"],
        assigneeId: 1,
        complexity: 4,
        dependencyIds: [101],
        status: "TODO",
        projectId: 10,
      }),
    );
    expect(within(column("TODO")).getByRole("article", { name: "Deploy" })).toBeInTheDocument();
  });

  it("exclui tarefa apenas após confirmação", async () => {
    const user = userEvent.setup();
    taskService.deleteTask.mockResolvedValue(undefined);
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Tela de login" }));

    const details = screen.getByRole("dialog", { name: "Tela de login" });
    await user.click(within(details).getByRole("button", { name: "Excluir" }));
    const confirm = screen.getByRole("dialog", { name: "Excluir tarefa?" });
    await user.click(within(confirm).getByRole("button", { name: "Cancelar" }));
    expect(taskService.deleteTask).not.toHaveBeenCalled();

    await user.click(within(screen.getByRole("dialog", { name: "Tela de login" })).getByRole("button", { name: "Excluir" }));
    await user.click(within(screen.getByRole("dialog", { name: "Excluir tarefa?" })).getByRole("button", { name: "Excluir" }));

    expect(taskService.deleteTask).toHaveBeenCalledWith(100);
    expect(await screen.findByRole("status")).toHaveTextContent('Tarefa "Tela de login" excluída.');
    expect(screen.queryByRole("article", { name: "Tela de login" })).not.toBeInTheDocument();
  });

  it("esconde ações de edição para quem não é da equipe e em projetos arquivados", async () => {
    projectService.getProject.mockResolvedValue(makeProject({ archived: true }));
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    expect(screen.queryByRole("button", { name: "Nova tarefa" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /Mover/ })).not.toBeInTheDocument();
    expect(screen.getByText(/apenas para leitura/)).toBeInTheDocument();
  });

  it("mostra erro de carregamento e permite tentar novamente", async () => {
    projectService.getProject.mockRejectedValueOnce(apiError(500)).mockResolvedValueOnce(makeProject());
    const user = userEvent.setup();
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Não foi possível carregar o projeto.");
    await user.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("article", { name: "Tela de login" })).toBeInTheDocument();
  });
});

describe("ProjectBoardPage — detalhes da tarefa", () => {
  it("exibe detalhes, dependências, comentários e histórico indisponível", async () => {
    const user = userEvent.setup();
    taskService.listProjectTasks.mockResolvedValue([
      makeTask({ dependencyIds: [101], requirements: "Deve validar e-mail" }),
      makeTask({ id: 101, title: "API de tarefas", status: "IN_PROGRESS" }),
    ]);
    taskService.listComments.mockResolvedValue([
      { id: 1, content: "Começando hoje", author: { id: 2, username: "bia" }, createdAt: "2026-11-20T10:00:00Z" },
    ]);
    taskService.addComment.mockResolvedValue({ id: 2, content: "Ótimo!", author: { id: 1, username: "ana" } });
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Tela de login" }));
    const dialog = screen.getByRole("dialog", { name: "Tela de login" });
    expect(within(dialog).getByText("Deve validar e-mail")).toBeInTheDocument();
    expect(within(within(dialog).getByRole("list", { name: "Depende de" })).getByText("API de tarefas")).toBeInTheDocument();
    expect(await within(dialog).findByText("Começando hoje")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Comentar" }));
    expect(within(dialog).getByText("Escreva o comentário antes de enviar.")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("Novo comentário"), "Ótimo!");
    await user.click(within(dialog).getByRole("button", { name: "Comentar" }));
    expect(taskService.addComment).toHaveBeenCalledWith(100, "Ótimo!");
    expect(await within(dialog).findByText("Ótimo!")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("tab", { name: /Histórico/ }));
    expect(await within(dialog).findByText(/histórico de alterações não está disponível/)).toBeInTheDocument();
  });

  it("valida o anexo antes do envio", async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Tela de login" }));
    const dialog = screen.getByRole("dialog", { name: "Tela de login" });
    await user.click(within(dialog).getByRole("tab", { name: /Anexos/ }));
    expect(await within(dialog).findByText("Nenhum anexo.")).toBeInTheDocument();

    const input = within(dialog).getByLabelText("Escolher arquivo");
    await user.upload(input, new File(["x"], "virus.exe"));
    expect(within(dialog).getByText(/Tipo de arquivo não permitido/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Enviar" })).toBeDisabled();

    taskService.uploadAttachment.mockResolvedValue({
      id: 5, fileName: "spec.pdf", contentType: "application/pdf", size: 3, uploadedBy: null,
    });
    await user.upload(input, new File(["pdf"], "spec.pdf", { type: "application/pdf" }));
    await user.click(within(dialog).getByRole("button", { name: "Enviar" }));
    expect(taskService.uploadAttachment).toHaveBeenCalledWith(100, expect.any(File));
    expect(await within(dialog).findByText("spec.pdf")).toBeInTheDocument();
  });
});

describe("ProjectBoardPage — equipe e competências", () => {
  it("lista integrantes e permite editar apenas as próprias competências", async () => {
    const user = userEvent.setup();
    // Como no backend: competências de outros integrantes só para o titular ou administrador.
    skillService.listUserSkills.mockImplementation(async (userId: number) => {
      if (userId === 2) throw apiError(403);
      return [];
    });
    skillService.createSkill.mockImplementation(async (userId: number, input: object) => [{ id: 1, userId, ...input }]);
    renderPage("/projects/10?aba=equipe");

    const bia = await screen.findByRole("article", { name: "bia" });
    expect(await within(bia).findByText(/visíveis apenas para o próprio integrante/)).toBeInTheDocument();
    expect(within(bia).queryByRole("button", { name: /competência/ })).not.toBeInTheDocument();

    const ana = screen.getByRole("article", { name: /ana/ });
    await user.click(await within(ana).findByRole("button", { name: "Adicionar competência" }));
    const dialog = screen.getByRole("dialog", { name: "Nova competência" });
    await user.click(within(dialog).getByRole("button", { name: "Adicionar" }));
    expect(await within(dialog).findByText("Adicione ao menos uma tecnologia.")).toBeInTheDocument();
    expect(within(dialog).getByText("Selecione o tipo de atividade.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Tecnologias"), "React{Enter}");
    await user.selectOptions(within(dialog).getByLabelText(/^Tipo de atividade/), "FRONTEND");
    await user.selectOptions(within(dialog).getByLabelText(/^Nível de experiência/), "3");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar" }));

    expect(skillService.createSkill).toHaveBeenCalledWith(
      1,
      { technologies: ["React"], activityType: "FRONTEND", level: 3 },
      [],
    );
    expect(await within(ana).findByText("Front-end")).toBeInTheDocument();
    expect(within(ana).getByText("Intermediário")).toBeInTheDocument();
  });

  it("informa quando o servidor não oferece competências", async () => {
    skillService.listUserSkills.mockRejectedValue(apiError(404));
    renderPage("/projects/10?aba=equipe");
    expect(await screen.findByText(/não está disponível no servidor/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar competência" })).not.toBeInTheDocument();
  });
});

describe("ProjectBoardPage — gerenciamento de colunas", () => {
  const COLUMNS = [
    { id: 1, name: "A fazer", status: "TODO", order: 0, custom: false },
    { id: 2, name: "Em andamento", status: "IN_PROGRESS", order: 1, custom: false },
    { id: 3, name: "Em revisão", status: "EM_REVISAO", order: 2, custom: true },
  ];

  it("mostra 'Nova coluna' e explica quando o servidor não oferece colunas", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    await user.click(screen.getByRole("button", { name: "Nova coluna" }));
    const dialog = screen.getByRole("dialog", { name: "Nova coluna" });
    expect(within(dialog).getByRole("status")).toHaveTextContent(/não oferece quadros para este projeto/);
    expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("cria coluna em uma posição escolhida", async () => {
    const user = userEvent.setup();
    taskService.listColumns.mockResolvedValue(COLUMNS);
    taskService.createColumn.mockResolvedValue({ id: 4, name: "Bloqueado", status: "BLOQUEADO", order: 3, custom: true });
    taskService.reorderColumns.mockResolvedValue([
      COLUMNS[0],
      { id: 4, name: "Bloqueado", status: "BLOQUEADO", order: 1, custom: true },
      { ...COLUMNS[1], order: 2 },
      { ...COLUMNS[2], order: 3 },
    ]);
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    await user.click(screen.getByRole("button", { name: "Nova coluna" }));
    const dialog = screen.getByRole("dialog", { name: "Nova coluna" });
    await user.type(within(dialog).getByLabelText("Nome"), "Bloqueado");
    await user.selectOptions(within(dialog).getByLabelText("Posição no quadro"), "1");
    await user.click(within(dialog).getByRole("button", { name: "Criar coluna" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(taskService.createColumn).toHaveBeenCalledWith(10, { name: "Bloqueado", status: "BLOQUEADO" });
    expect(taskService.reorderColumns).toHaveBeenCalledWith(10, [1, 4, 2, 3]);
    const headings = within(screen.getByRole("region", { name: "Quadro Kanban" }))
      .getAllByRole("heading", { level: 2 })
      .map((h) => h.textContent?.replace(/\d+$/, ""));
    expect(headings).toEqual(["A fazer", "Bloqueado", "Em andamento", "Em revisão"]);
  });

  it("a primeira coluna cria o quadro e as colunas padrão passam a ser editáveis", async () => {
    const user = userEvent.setup();
    const board = [...COLUMNS.slice(0, 2), { id: 4, name: "Bloqueado", status: "COLUNA_4", order: 2, custom: true }];
    taskService.listColumns.mockResolvedValueOnce([]).mockResolvedValue(board);
    taskService.createColumn.mockResolvedValue(board[2]);
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    expect(screen.queryByRole("button", { name: "Editar coluna A fazer" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Nova coluna" }));
    const dialog = screen.getByRole("dialog", { name: "Nova coluna" });
    await user.type(within(dialog).getByLabelText("Nome"), "Bloqueado");
    await user.click(within(dialog).getByRole("button", { name: "Criar coluna" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(taskService.reorderColumns).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Editar coluna A fazer" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar coluna Bloqueado" })).toBeInTheDocument();
  });

  it("renomeia e move a coluna para outra posição", async () => {
    const user = userEvent.setup();
    taskService.listColumns.mockResolvedValue(COLUMNS);
    taskService.updateColumn.mockResolvedValue({ ...COLUMNS[2], name: "Revisão" });
    taskService.reorderColumns.mockResolvedValue([
      { ...COLUMNS[2], name: "Revisão", order: 0 },
      { ...COLUMNS[0], order: 1 },
      { ...COLUMNS[1], order: 2 },
    ]);
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    await user.click(screen.getByRole("button", { name: "Editar coluna Em revisão" }));
    const dialog = screen.getByRole("dialog", { name: "Editar coluna" });
    await user.clear(within(dialog).getByLabelText("Nome"));
    await user.type(within(dialog).getByLabelText("Nome"), "Revisão");
    await user.selectOptions(within(dialog).getByLabelText("Posição no quadro"), "0");
    await user.click(within(dialog).getByRole("button", { name: "Salvar coluna" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(taskService.updateColumn).toHaveBeenCalledWith(10, 3, { name: "Revisão", status: "EM_REVISAO" });
    expect(taskService.reorderColumns).toHaveBeenCalledWith(10, [3, 1, 2]);
    expect(screen.getByRole("status")).toHaveTextContent('Coluna "Revisão" atualizada.');
  });

  it("exclui coluna movendo as tarefas dela para outra", async () => {
    const user = userEvent.setup();
    taskService.listColumns.mockResolvedValue(COLUMNS);
    taskService.deleteColumn.mockResolvedValue(undefined);
    taskService.listProjectTasks.mockResolvedValue([makeTask({ status: "EM_REVISAO" })]);
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    await user.click(screen.getByRole("button", { name: "Editar coluna Em revisão" }));
    await user.click(screen.getByRole("button", { name: "Excluir coluna" }));

    const dialog = screen.getByRole("dialog", { name: 'Excluir a coluna "Em revisão"?' });
    expect(dialog).toHaveAccessibleDescription(/1 tarefa/);
    await user.selectOptions(within(dialog).getByLabelText("Mover as tarefas para"), "IN_PROGRESS");
    await user.click(within(dialog).getByRole("button", { name: "Excluir coluna" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(taskService.deleteColumn).toHaveBeenCalledWith(10, 3, "IN_PROGRESS");
    expect(column("EM_REVISAO")).toBeNull();
    expect(within(column("IN_PROGRESS")).getByRole("article", { name: "Tela de login" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent('Suas tarefas foram movidas para "Em andamento"');
  });

  it("mantém a coluna e mostra o erro quando a exclusão falha", async () => {
    const user = userEvent.setup();
    taskService.listColumns.mockResolvedValue(COLUMNS);
    taskService.deleteColumn.mockRejectedValue(apiError(409, "O quadro precisa de ao menos uma coluna."));
    renderPage();
    await screen.findByRole("article", { name: "Tela de login" });
    await user.click(screen.getByRole("button", { name: "Editar coluna Em revisão" }));
    await user.click(screen.getByRole("button", { name: "Excluir coluna" }));
    const dialog = screen.getByRole("dialog", { name: 'Excluir a coluna "Em revisão"?' });
    await user.click(within(dialog).getByRole("button", { name: "Excluir coluna" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("O quadro precisa de ao menos uma coluna.");
    expect(column("EM_REVISAO")).not.toBeNull();
  });
});

describe("ProjectBoardPage — campos que o servidor não grava", () => {
  it("avisa quando o responsável enviado não volta na resposta", async () => {
    const user = userEvent.setup();
    // Simula o backend atual, que ignora responsavelId.
    taskService.updateTask.mockImplementation(async (id: number, input: TaskInput) =>
      makeTask({ ...input, id, content: input.content ?? null, assigneeId: null } as Partial<Task>),
    );
    renderPage();
    await user.click(await screen.findByRole("button", { name: "API de tarefas" }));
    await user.click(screen.getByRole("button", { name: "Editar" }));
    const form = screen.getByRole("dialog", { name: "Editar tarefa" });
    await user.selectOptions(within(form).getByLabelText("Responsável"), "2");
    await user.click(within(form).getByRole("button", { name: "Salvar alterações" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      '"API de tarefas" foi salva, mas o servidor não gravou: responsável.',
    );
  });
});
