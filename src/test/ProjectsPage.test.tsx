import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, AxiosHeaders } from "axios";
import type { Project, ProjectInput } from "@/features/projects/types";

const projectService = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  unarchiveProject: vi.fn(),
}));
const userService = vi.hoisted(() => ({ listUsers: vi.fn() }));

vi.mock("@/features/projects/services/projectService", () => projectService);
vi.mock("@/features/users/services/userService", () => userService);
vi.mock("@/features/auth/hooks/AuthContext", () => ({
  useAuth: () => ({
    user: { id: 1, username: "ana", email: "ana@ex.com", roles: ["MEMBER"] },
    logout: vi.fn(),
  }),
}));

import { ProjectsPage } from "@/features/projects/pages/ProjectsPage";

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

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  userService.listUsers.mockResolvedValue([
    { id: 1, username: "ana", email: "ana@ex.com" },
    { id: 2, username: "bia", email: "bia@ex.com" },
    { id: 3, username: "caio", email: "caio@ex.com" },
  ]);
});

describe("ProjectsPage", () => {
  it("mostra carregamento e depois nome, descrição e equipe", async () => {
    projectService.listProjects.mockResolvedValue([makeProject()]);
    renderPage();
    expect(screen.getByText("Carregando projetos...")).toBeInTheDocument();

    const card = await screen.findByRole("article", { name: "Sistema RAG" });
    expect(within(card).getByText("Plataforma com IA")).toBeInTheDocument();
    const team = within(card).getByRole("list", { name: "Equipe" });
    expect(within(team).getByText(/ana/)).toBeInTheDocument();
    expect(within(team).getByText("bia")).toBeInTheDocument();
  });

  it("informa quando não há projetos", async () => {
    projectService.listProjects.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("Nenhum projeto ativo")).toBeInTheDocument();
  });

  it("exibe erro de carregamento compreensível e permite tentar de novo", async () => {
    projectService.listProjects
      .mockRejectedValueOnce(apiError(500))
      .mockResolvedValueOnce([makeProject()]);
    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("O servidor encontrou um erro");
    await userEvent.click(within(alert).getByRole("button", { name: "Tentar novamente" }));
    expect(await screen.findByRole("article", { name: "Sistema RAG" })).toBeInTheDocument();
  });

  it("esconde ações de gerenciamento sem permissão", async () => {
    projectService.listProjects.mockResolvedValue([
      makeProject({ canManage: false, myRole: "MEMBER" }),
    ]);
    renderPage();
    const card = await screen.findByRole("article", { name: "Sistema RAG" });
    expect(within(card).queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /arquivar/i })).not.toBeInTheDocument();
    expect(within(card).getByText("Membro")).toBeInTheDocument();
  });

  it("só arquiva após confirmação e reflete o retorno do backend", async () => {
    const user = userEvent.setup();
    projectService.listProjects.mockResolvedValue([makeProject()]);
    projectService.archiveProject.mockResolvedValue(makeProject({ archived: true }));
    renderPage();

    const card = await screen.findByRole("article", { name: "Sistema RAG" });
    await user.click(within(card).getByRole("button", { name: /arquivar/i }));
    const dialog = screen.getByRole("dialog", { name: "Arquivar projeto?" });
    expect(projectService.archiveProject).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(projectService.archiveProject).not.toHaveBeenCalled();

    await user.click(within(card).getByRole("button", { name: /arquivar/i }));
    await user.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Arquivar" }),
    );

    expect(projectService.archiveProject).toHaveBeenCalledWith(10);
    expect(await screen.findByRole("status")).toHaveTextContent('Projeto "Sistema RAG" arquivado.');
    expect(screen.getByText("Nenhum projeto ativo")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: /arquivados/i }));
    expect(screen.getByRole("article", { name: "Sistema RAG" })).toHaveTextContent("Arquivado");
  });

  it("mantém o diálogo aberto e mostra o erro do backend ao falhar o arquivamento", async () => {
    const user = userEvent.setup();
    projectService.listProjects.mockResolvedValue([makeProject()]);
    projectService.archiveProject.mockRejectedValue(
      apiError(403, "Você não tem permissão para gerenciar este projeto."),
    );
    renderPage();
    const card = await screen.findByRole("article", { name: "Sistema RAG" });
    await user.click(within(card).getByRole("button", { name: /arquivar/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Arquivar" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Você não tem permissão para gerenciar este projeto.",
    );
  });

  it("cria projeto validando o nome e enviando a equipe selecionada", async () => {
    const user = userEvent.setup();
    projectService.listProjects.mockResolvedValue([]);
    projectService.createProject.mockImplementation(async (input: ProjectInput) =>
      makeProject({
        id: 11,
        name: input.name,
        description: input.description ?? null,
        teamIds: input.teamIds ?? [],
      }),
    );
    renderPage();
    await screen.findByText("Nenhum projeto ativo");

    await user.click(screen.getByRole("button", { name: /novo projeto/i }));
    const dialog = screen.getByRole("dialog", { name: "Novo projeto" });
    await user.click(within(dialog).getByRole("button", { name: "Criar projeto" }));
    expect(await within(dialog).findByText("Informe o nome do projeto.")).toBeInTheDocument();
    expect(projectService.createProject).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/^Nome/), "Portal");
    await user.type(within(dialog).getByLabelText("Descrição"), "Novo portal");
    const creatorCheckbox = await within(dialog).findByRole("checkbox", { name: /ana/ });
    expect(creatorCheckbox).toBeChecked();
    expect(creatorCheckbox).toBeDisabled();
    await user.click(within(dialog).getByRole("checkbox", { name: /caio/ }));
    await user.click(within(dialog).getByRole("button", { name: "Criar projeto" }));

    await waitFor(() =>
      expect(projectService.createProject).toHaveBeenCalledWith({
        name: "Portal",
        description: "Novo portal",
        teamIds: [1, 3],
      }),
    );
    expect(await screen.findByRole("article", { name: "Portal" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("edita projeto e mostra o erro devolvido pelo backend", async () => {
    const user = userEvent.setup();
    projectService.listProjects.mockResolvedValue([makeProject()]);
    projectService.updateProject.mockRejectedValueOnce(
      apiError(409, "Projetos arquivados não podem ser editados."),
    );
    renderPage();
    const card = await screen.findByRole("article", { name: "Sistema RAG" });
    await user.click(within(card).getByRole("button", { name: /editar/i }));

    const dialog = screen.getByRole("dialog", { name: "Editar projeto" });
    expect(within(dialog).getByLabelText("Nome")).toHaveValue("Sistema RAG");
    expect(await within(dialog).findByRole("checkbox", { name: /bia/ })).toBeChecked();

    await user.click(within(dialog).getByRole("button", { name: "Salvar alterações" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Projetos arquivados não podem ser editados.",
    );
    expect(projectService.updateProject).toHaveBeenCalledWith(10, {
      name: "Sistema RAG",
      description: "Plataforma com IA",
      teamIds: [1, 2],
    });
  });
});
