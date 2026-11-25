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
    team: [
      { id: 1, username: "ana", email: "ana@ex.com" },
      { id: 2, username: "bia", email: "bia@ex.com" },
    ],
    teamIds: [1, 2],
    taskIds: [],
    myRole: "MANAGER",
    canManage: true,
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
    complexity: "MEDIUM",
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
    expect(within(card).getByText("Complexidade Média")).toBeInTheDocument();
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
    await user.selectOptions(within(dialog).getByLabelText("Complexidade"), "HIGH");
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
        complexity: "HIGH",
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
    skillService.listUserSkills.mockImplementation(async (userId: number) =>
      userId === 2
        ? [{ id: 7, userId: 2, technologies: ["Java"], activityType: "BACKEND", level: "AVANCADO" }]
        : [],
    );
    skillService.createSkill.mockImplementation(async (userId: number, input: object) => ({ id: 8, userId, ...input }));
    renderPage("/projects/10?aba=equipe");

    const bia = await screen.findByRole("article", { name: "bia" });
    expect(await within(bia).findByText("Back-end")).toBeInTheDocument();
    expect(within(bia).getByText("Avançado")).toBeInTheDocument();
    expect(within(bia).queryByRole("button", { name: /competência/ })).not.toBeInTheDocument();

    const ana = screen.getByRole("article", { name: /ana/ });
    await user.click(await within(ana).findByRole("button", { name: "Adicionar competência" }));
    const dialog = screen.getByRole("dialog", { name: "Nova competência" });
    await user.click(within(dialog).getByRole("button", { name: "Adicionar" }));
    expect(await within(dialog).findByText("Adicione ao menos uma tecnologia.")).toBeInTheDocument();
    expect(within(dialog).getByText("Selecione o tipo de atividade.")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Tecnologias"), "React{Enter}");
    await user.selectOptions(within(dialog).getByLabelText(/^Tipo de atividade/), "FRONTEND");
    await user.selectOptions(within(dialog).getByLabelText(/^Nível de experiência/), "INTERMEDIARIO");
    await user.click(within(dialog).getByRole("button", { name: "Adicionar" }));

    expect(skillService.createSkill).toHaveBeenCalledWith(1, {
      technologies: ["React"],
      activityType: "FRONTEND",
      level: "INTERMEDIARIO",
    });
    expect(await within(ana).findByText("Front-end")).toBeInTheDocument();
  });

  it("informa quando o servidor não oferece competências", async () => {
    skillService.listUserSkills.mockRejectedValue(apiError(404));
    renderPage("/projects/10?aba=equipe");
    expect(await screen.findByText(/não está disponível no servidor/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Adicionar competência" })).not.toBeInTheDocument();
  });
});
