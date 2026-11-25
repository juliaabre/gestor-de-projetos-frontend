/**
 * Auditoria automática de acessibilidade (axe-core) nas telas principais:
 * rótulos, nomes acessíveis de botões/links, ARIA válido, hierarquia de
 * landmarks etc. Contraste de cor não é medido no jsdom; ele foi revisado à
 * parte (texto secundário usa slate-500 ou mais escuro, ≥ 4.5:1).
 */
import axe from "axe-core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { apiError, makeProject, makeTask } from "./fixtures";

const auth = vi.hoisted(() => ({
  user: { id: 1, username: "ana", email: "ana@ex.com", roles: ["ADMIN", "MANAGER"] as string[] },
}));
const projectService = vi.hoisted(() => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  archiveProject: vi.fn(),
  unarchiveProject: vi.fn(),
}));
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

vi.mock("@/features/projects/services/projectService", () => projectService);
vi.mock("@/features/tasks/services/taskService", () => taskService);
vi.mock("@/features/ai/services/aiService", () => aiService);
vi.mock("@/features/admin/services/knowledgeService", () => knowledge);
vi.mock("@/features/users/services/userService", () => ({
  listUsers: vi.fn().mockResolvedValue([{ id: 2, username: "bia", email: "bia@ex.com" }]),
}));
vi.mock("@/features/skills/services/skillService", () => ({
  listUserSkills: vi.fn().mockResolvedValue([
    { id: 1, userId: 1, technologies: ["React"], activityType: "FRONTEND", level: "SENIOR" },
  ]),
}));
vi.mock("@/features/auth/hooks/AuthContext", () => ({
  useAuth: () => ({ user: auth.user, logout: vi.fn(), login: vi.fn(), register: vi.fn(), isLoading: false }),
}));

import { LoginPage } from "@/features/auth/pages/LoginPage";
import { RegisterPage } from "@/features/auth/pages/RegisterPage";
import { DashboardPage } from "@/features/dashboard/pages/DashboardPage";
import { ProjectsPage } from "@/features/projects/pages/ProjectsPage";
import { ProjectBoardPage } from "@/features/projects/pages/ProjectBoardPage";
import { KnowledgeBasePage } from "@/features/admin/pages/KnowledgeBasePage";

async function expectAccessible(container: Element = document.body) {
  const results = await axe.run(container, {
    rules: { "color-contrast": { enabled: false } },
  });
  const violations = results.violations.map(
    (v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(" ")).join("\n  ")}`,
  );
  expect(violations, violations.join("\n")).toEqual([]);
}

function renderRoute(path: string, pattern: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  projectService.listProjects.mockResolvedValue([makeProject(), makeProject({ id: 11, name: "Portal", archived: true })]);
  projectService.getProject.mockResolvedValue(makeProject());
  taskService.listProjectTasks.mockResolvedValue([
    makeTask(),
    makeTask({ id: 101, title: "Modelagem do banco", assigneeId: 2, status: "IN_PROGRESS", dependencyIds: [100] }),
  ]);
  taskService.listColumns.mockRejectedValue(apiError(404));
  taskService.listComments.mockResolvedValue([]);
  taskService.listAttachments.mockResolvedValue([]);
  taskService.listHistory.mockRejectedValue(apiError(404));
  aiService.recommendAssignees.mockResolvedValue({
    recommendationId: 1,
    fallback: false,
    items: [
      { userId: 2, username: "bia", score: 90, justification: "Experiência em JWT.", skills: ["JWT"], currentLoad: 1, sources: [] },
    ],
  });
  aiService.getConversation.mockResolvedValue([]);
  aiService.getSummary.mockResolvedValue({ summary: "Projeto 40% concluído.", sources: [] });
  aiService.getBottlenecks.mockResolvedValue([]);
  aiService.suggestDependencies.mockResolvedValue([]);
  knowledge.listDocuments.mockResolvedValue([]);
  knowledge.listRules.mockResolvedValue([]);
  knowledge.listTerms.mockResolvedValue([]);
});

describe("acessibilidade das telas principais", () => {
  it("login e cadastro, inclusive com erros de validação", async () => {
    const { unmount } = renderRoute("/login", "/login", <LoginPage />);
    await expectAccessible();
    await userEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await screen.findByText("Informe seu e-mail.");
    await expectAccessible();
    unmount();

    renderRoute("/register", "/register", <RegisterPage />);
    await expectAccessible();
  });

  it("início e lista de projetos", async () => {
    const { unmount } = renderRoute("/dashboard", "/dashboard", <DashboardPage />);
    await screen.findByRole("link", { name: "Sistema RAG" });
    await expectAccessible();
    unmount();

    renderRoute("/projects", "/projects", <ProjectsPage />);
    await screen.findByRole("article", { name: "Sistema RAG" });
    await expectAccessible();
    await userEvent.click(screen.getByRole("button", { name: /novo projeto/i }));
    await screen.findByRole("dialog");
    await expectAccessible();
  });

  it("quadro Kanban, detalhes da tarefa e formulário", async () => {
    const user = userEvent.setup();
    renderRoute("/projects/10", "/projects/:projectId", <ProjectBoardPage />);
    const card = await screen.findByRole("article", { name: "Autenticação JWT" });
    await expectAccessible();

    await user.click(within(card).getByRole("button", { name: "Autenticação JWT" }));
    await screen.findByRole("dialog");
    await expectAccessible();
    await user.keyboard("{Escape}");

    await user.click(screen.getAllByRole("button", { name: /nova tarefa|adicionar tarefa/i })[0]);
    await screen.findByRole("dialog");
    await expectAccessible();
  });

  it("recomendação de responsável", async () => {
    const user = userEvent.setup();
    renderRoute("/projects/10", "/projects/:projectId", <ProjectBoardPage />);
    const card = await screen.findByRole("article", { name: "Autenticação JWT" });
    await user.click(within(card).getByRole("button", { name: /sugerir responsável/i }));
    await screen.findByText("Experiência em JWT.");
    await expectAccessible();
  });

  it("abas de equipe e assistente", async () => {
    const { unmount } = renderRoute("/projects/10?aba=equipe", "/projects/:projectId", <ProjectBoardPage />);
    await screen.findAllByText("React");
    await expectAccessible();
    unmount();

    renderRoute("/projects/10?aba=assistente", "/projects/:projectId", <ProjectBoardPage />);
    await screen.findByText("Projeto 40% concluído.");
    await expectAccessible();
  });

  it("base de conhecimento", async () => {
    renderRoute("/admin/conhecimento", "/admin/conhecimento", <KnowledgeBasePage />);
    await screen.findByRole("tabpanel");
    await expectAccessible();
  });
});

describe("uso pelo teclado", () => {
  it("o primeiro Tab leva ao atalho 'Pular para o conteúdo'", async () => {
    const user = userEvent.setup();
    renderRoute("/projects", "/projects", <ProjectsPage />);
    await user.tab();
    const skip = screen.getByRole("link", { name: "Pular para o conteúdo" });
    expect(skip).toHaveFocus();
    expect(skip).toHaveAttribute("href", "#conteudo");
    expect(document.getElementById("conteudo")?.tagName).toBe("MAIN");
  });

  it("move uma tarefa de coluna sem usar o mouse", async () => {
    taskService.moveTask.mockImplementation(async (task, status) => ({ ...task, status }));
    const user = userEvent.setup();
    renderRoute("/projects/10", "/projects/:projectId", <ProjectBoardPage />);
    const card = await screen.findByRole("article", { name: "Autenticação JWT" });
    const select = within(card).getByRole("combobox");
    select.focus();
    await user.selectOptions(select, "DONE");
    expect(taskService.moveTask).toHaveBeenCalledWith(expect.objectContaining({ id: 100 }), "DONE");
  });

  it("em telas pequenas, o seletor de colunas leva direto à coluna escolhida", async () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    const user = userEvent.setup();
    renderRoute("/projects/10", "/projects/:projectId", <ProjectBoardPage />);
    await screen.findByRole("article", { name: "Autenticação JWT" });
    const nav = screen.getByRole("navigation", { name: "Ir para a coluna" });
    const target = within(nav).getByRole("button", { name: /Em andamento · 1/ });
    await user.click(target);
    expect(target).toHaveAttribute("aria-current", "true");
    expect(scrollIntoView).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /Em andamento/ })).toHaveFocus();
  });
});
