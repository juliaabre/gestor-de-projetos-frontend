/**
 * Testes de integração contra o backend real (Spring, branch
 * `feat/gerencia-por-projeto`). Usam os mesmos serviços e mapeadores das
 * telas, então validam o contrato de ponta a ponta: rotas, DTOs, códigos de
 * erro e permissões por perfil.
 *
 * Execução: com o backend rodando, `pnpm test:integration`.
 *   BACKEND_URL            padrão http://localhost:8080
 *   BACKEND_ADMIN_EMAIL    opcional; habilita os cenários do Administrador
 *   BACKEND_ADMIN_PASSWORD (usuário criado pelo DataInitializer do backend)
 *
 * Use um banco de desenvolvimento ou de testes: os testes criam usuários,
 * projetos e tarefas (e removem os projetos ao final).
 */
import axios from "axios";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { session } from "@/lib/session";
import { getErrorMessage } from "@/lib/apiError";
import { login, register } from "@/features/auth/services/authService";
import type { AuthResult } from "@/features/auth/types";
import {
  archiveProject,
  createProject,
  getProject,
  listProjects,
  unarchiveProject,
  updateProject,
} from "@/features/projects/services/projectService";
import { getProjectPermissions } from "@/features/projects/permissions";
import { listUsers } from "@/features/users/services/userService";
import {
  addComment,
  createTask,
  deleteTask,
  getTask,
  listComments,
  listDependencies,
  createColumn,
  deleteColumn,
  listColumns,
  listHistory,
  listProjectTasks,
  moveTask,
  reorderColumns,
  updateColumn,
  updateTask,
} from "@/features/tasks/services/taskService";
import { taskToInput } from "@/features/tasks/mappers";
import type { Task } from "@/features/tasks/types";
import { createSkill, listUserSkills } from "@/features/skills/services/skillService";
import {
  askAssistant,
  generateDescription,
  getBottlenecks,
  getSummary,
  recommendAssignees,
  registerDecision,
  suggestDependencies,
} from "@/features/ai/services/aiService";
import { getDomain, listDocuments } from "@/features/admin/services/knowledgeService";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8080";
const ADMIN_EMAIL = process.env.BACKEND_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.BACKEND_ADMIN_PASSWORD;

// No Node não há CORS: o adaptador HTTP fala direto com o backend.
api.defaults.baseURL = BACKEND_URL;
api.defaults.adapter = "http";

const runId = Date.now().toString(36);
const credentials = (name: string) => ({
  username: `${name}-${runId}`,
  email: `${name}-${runId}@teste.dev`,
  password: "senha123",
});

/** Passa a agir como o usuário, como o AuthContext faz após o login. */
function actAs(auth: AuthResult) {
  session.save(auth.token, auth.user);
}

async function expectStatus(promise: Promise<unknown>, status: number) {
  const error = await promise.then(
    () => null,
    (err: unknown) => err,
  );
  expect(axios.isAxiosError(error), "a requisição deveria falhar").toBe(true);
  expect(axios.isAxiosError(error) && error.response?.status).toBe(status);
  return error;
}

let manager: AuthResult;
let member: AuthResult;
let outsider: AuthResult;
let projectId: number;
const createdProjects: number[] = [];

beforeAll(async () => {
  try {
    await axios.get(`${BACKEND_URL}/api/projetos`, { adapter: "http", validateStatus: () => true });
  } catch {
    throw new Error(`Backend indisponível em ${BACKEND_URL}. Suba o backend ou defina BACKEND_URL.`);
  }
  await register(credentials("gerente"));
  member = await register(credentials("membro"));
  outsider = await register(credentials("externo"));

  // Quem cria o projeto vira o gerente dele; só então o diretório de usuários
  // é liberado para montar a equipe.
  actAs(await login({ email: credentials("gerente").email, password: "senha123" }));
  const project = await createProject({ name: `Projeto integração ${runId}` });
  projectId = project.id;
  createdProjects.push(project.id);
  manager = await login({ email: credentials("gerente").email, password: "senha123" });
  actAs(manager);
  const users = await listUsers();
  const memberId = users.find((u) => u.email === credentials("membro").email)!.id;
  await updateProject(projectId, { name: project.name, teamIds: [memberId] });
  member = await login({ email: credentials("membro").email, password: "senha123" });
});

afterAll(async () => {
  if (!manager) return;
  actAs(manager);
  for (const id of createdProjects) {
    await api.delete(endpoints.projects.byId(id)).catch(() => undefined);
  }
  session.clear();
});

describe("autenticação e identificação do usuário", () => {
  it("cadastro devolve token e o perfil global Membro", () => {
    expect(outsider.token.split(".")).toHaveLength(3);
    expect(outsider.user.roles).toEqual(["MEMBER"]);
  });

  it("o id do usuário é descoberto mesmo sem acesso ao diretório (via equipe do projeto)", () => {
    // Membros não podem listar usuários (403); o frontend acha o próprio id na equipe.
    expect(manager.user.id).toEqual(expect.any(Number));
    expect(member.user.id).toEqual(expect.any(Number));
  });

  it("senha errada gera 401 com mensagem amigável", async () => {
    const error = await expectStatus(login({ email: credentials("gerente").email, password: "errada" }), 401);
    expect(getErrorMessage(error, "fallback")).toMatch(/inválid/i);
  });

  it("e-mail já cadastrado é recusado", async () => {
    const error = await register(credentials("gerente")).catch((err: unknown) => err);
    expect(axios.isAxiosError(error)).toBe(true);
    expect(getErrorMessage(error, "fallback")).not.toBe("fallback");
  });

  it("diretório de usuários: liberado ao gerente, negado a quem não gerencia projeto", async () => {
    actAs(manager);
    expect((await listUsers()).length).toBeGreaterThanOrEqual(3);
    actAs(member);
    await expectStatus(listUsers(), 403);
  });
});

describe("projetos e permissões por perfil", () => {
  it("criador é o gerente do projeto", async () => {
    actAs(manager);
    const project = await getProject(projectId);
    expect(project).toMatchObject({ myRole: "MANAGER", canManage: true, canAddMembers: true, managerId: manager.user.id });
    expect(getProjectPermissions(project, manager.user)).toMatchObject({
      canEditTasks: true,
      canDeleteTasks: true,
      canUseManagerAi: true,
    });
  });

  it("membro vê o projeto e move tarefas, mas não edita", async () => {
    actAs(member);
    const project = await getProject(projectId);
    expect(project).toMatchObject({ myRole: "MEMBER", canManage: false });
    expect(getProjectPermissions(project, member.user)).toMatchObject({
      canMoveTasks: true,
      canEditTasks: false,
      canUseManagerAi: false,
    });
    await expectStatus(updateProject(projectId, { name: "Invasão" }), 403);
    await expectStatus(archiveProject(projectId), 403);
  });

  it("usuário fora da equipe não lista nem abre o projeto", async () => {
    actAs(outsider);
    expect((await listProjects()).map((p) => p.id)).not.toContain(projectId);
    await expectStatus(getProject(projectId), 403);
  });

  it("projeto arquivado fica somente leitura e pode ser desarquivado", async () => {
    actAs(manager);
    const archived = await archiveProject(projectId);
    expect(getProjectPermissions(archived, manager.user).canEditTasks).toBe(false);
    await expectStatus(updateProject(projectId, { name: "Editar arquivado" }), 409);
    expect((await unarchiveProject(projectId)).archived).toBe(false);
  });

  it("gerência pode ser transferida a um integrante e devolvida", async () => {
    actAs(manager);
    const name = `Projeto integração ${runId}`;
    const transferred = await updateProject(projectId, { name, managerId: member.user.id });
    expect(transferred).toMatchObject({ managerId: member.user.id, canManage: false });
    actAs(member);
    const back = await updateProject(projectId, { name, managerId: manager.user.id });
    expect(back.managerId).toBe(manager.user.id);
  });
});

describe("quadro e tarefas", () => {
  let task: Task;
  let prerequisite: Task;

  beforeAll(async () => {
    actAs(manager);
    prerequisite = await createTask({ title: "Modelagem", status: "TODO", priority: "HIGH", projectId });
    task = await createTask({
      title: "API de login",
      status: "TODO",
      priority: "HIGH",
      complexity: 4,
      technologies: ["Java", "JWT"],
      dueDate: "2026-12-01",
      requirements: "Token de 1h",
      assigneeId: member.user.id,
      dependencyIds: [prerequisite.id],
      projectId,
    });
  });

  it("cria com campos estendidos e dependências", async () => {
    expect(task).toMatchObject({
      complexity: 4,
      technologies: ["Java", "JWT"],
      dueDate: "2026-12-01",
      requirements: "Token de 1h",
      assigneeId: member.user.id,
      dependencyIds: [prerequisite.id],
    });
    expect(await listDependencies(task.id)).toEqual([prerequisite.id]);
  });

  it("membro move a tarefa (PATCH de status), mas não cria nem edita", async () => {
    actAs(member);
    const moved = await moveTask(task, "IN_PROGRESS");
    expect(moved.status).toBe("IN_PROGRESS");
    await expectStatus(createTask({ title: "x", status: "TODO", priority: "LOW", projectId }), 403);
    await expectStatus(updateTask(task.id, taskToInput(moved, { title: "Outro" })), 403);
  });

  it("gerente edita e remove dependências", async () => {
    actAs(manager);
    const current = await getTask(task.id);
    const edited = await updateTask(task.id, taskToInput(current, { title: "API de login v2", dependencyIds: [] }));
    expect(edited).toMatchObject({ title: "API de login v2", dependencyIds: [] });
  });

  it("comentários e histórico registram autor e ações", async () => {
    actAs(member);
    const comment = await addComment(task.id, "Comecei hoje.");
    expect(comment).toMatchObject({ content: "Comecei hoje.", author: { id: member.user.id } });
    expect((await listComments(task.id)).map((c) => c.content)).toContain("Comecei hoje.");
    const history = await listHistory(task.id);
    expect(history.map((h) => h.action)).toEqual(expect.arrayContaining(["CRIACAO", "STATUS"]));
    expect(history.find((h) => h.action === "STATUS")).toMatchObject({ actorId: member.user.id, status: "IN_PROGRESS" });
  });

  it("criar tarefa nunca sobrescreve uma tarefa existente", async () => {
    actAs(manager);
    const a = await createTask({ title: "A", status: "TODO", priority: "LOW", projectId });
    const b = await createTask({ title: "B", status: "TODO", priority: "LOW", projectId });
    expect(b.id).not.toBe(a.id);
    const titles = (await listProjectTasks(projectId)).map((t) => t.title);
    expect(titles).toEqual(expect.arrayContaining(["A", "B"]));
    await deleteTask(a.id);
    await deleteTask(b.id);
  });

  it("título vazio é recusado com mensagem do servidor", async () => {
    actAs(manager);
    const error = await expectStatus(createTask({ title: "", status: "TODO", priority: "LOW", projectId }), 400);
    expect(getErrorMessage(error, "fallback")).not.toBe("fallback");
  });
});

describe("colunas personalizadas (quadros)", () => {
  let boardProjectId: number;
  let early: Task;

  beforeAll(async () => {
    actAs(manager);
    const project = await createProject({ name: `Quadro integração ${runId}` });
    boardProjectId = project.id;
    createdProjects.push(project.id);
    await updateProject(boardProjectId, { name: project.name, teamIds: [member.user.id!] });
    // Tarefa criada antes de existir quadro: fica sem coluna gravada.
    early = await createTask({ title: "Antes do quadro", status: "TODO", priority: "LOW", projectId: boardProjectId });
  });

  it("projeto novo não tem quadro; membro não cria coluna", async () => {
    actAs(manager);
    expect(await listColumns(boardProjectId)).toEqual([]);
    expect(early.columnId).toBeNull();
    actAs(member);
    await expectStatus(createColumn(boardProjectId, { name: "Bloqueado" }), 403);
  });

  it("a primeira coluna cria o quadro com as colunas padrão", async () => {
    actAs(manager);
    const created = await createColumn(boardProjectId, { name: "Revisão" });
    expect(created).toMatchObject({ name: "Revisão", custom: true });
    expect(created.status).toBe(`COLUNA_${created.id}`);
    const columns = await listColumns(boardProjectId);
    expect(columns.map((c) => [c.name, c.status])).toEqual([
      ["A fazer", "TODO"],
      ["Em andamento", "IN_PROGRESS"],
      ["Concluído", "DONE"],
      ["Cancelado", "CANCELLED"],
      ["Revisão", created.status],
    ]);
  });

  it("tarefa entra na coluna; membro a move para coluna sem status e o status real se mantém", async () => {
    actAs(manager);
    const columns = await listColumns(boardProjectId);
    const todo = columns.find((c) => c.status === "TODO")!;
    const review = columns.find((c) => c.name === "Revisão")!;
    const task = await createTask({ title: "Revisar login", status: "TODO", priority: "HIGH", projectId: boardProjectId });
    expect(task).toMatchObject({ status: "TODO", columnId: todo.id });

    actAs(member);
    const moved = await moveTask(task, review.status);
    expect(moved).toMatchObject({ status: review.status, columnId: review.id, baseStatus: "TODO" });
    expect((await listHistory(task.id)).map((h) => h.action)).toContain("COLUNA");

    actAs(manager);
    const edited = await updateTask(task.id, taskToInput(moved, { title: "Revisar login v2" }));
    expect(edited).toMatchObject({ title: "Revisar login v2", status: review.status, columnId: review.id });
    const back = await moveTask(edited, "DONE");
    expect(back).toMatchObject({ status: "DONE", baseStatus: "DONE" });
  });

  it("renomeia e reordena colunas", async () => {
    actAs(manager);
    const review = (await listColumns(boardProjectId)).find((c) => c.name === "Revisão")!;
    expect((await updateColumn(boardProjectId, review.id!, { name: "Em revisão" })).name).toBe("Em revisão");
    const ids = (await listColumns(boardProjectId)).map((c) => c.id!);
    const reordered = await reorderColumns(boardProjectId, [ids[0], review.id!, ...ids.slice(1).filter((id) => id !== review.id)]);
    expect(reordered.map((c) => c.name).slice(0, 2)).toEqual(["A fazer", "Em revisão"]);
  });

  it("excluir coluna com tarefas exige destino e leva também as sem coluna gravada", async () => {
    actAs(manager);
    const columns = await listColumns(boardProjectId);
    const todo = columns.find((c) => c.status === "TODO")!;
    const task = await createTask({ title: "Na fila", status: "TODO", priority: "LOW", projectId: boardProjectId });
    await expectStatus(deleteColumn(boardProjectId, todo.id!), 409);

    await deleteColumn(boardProjectId, todo.id!, "IN_PROGRESS");
    expect((await listColumns(boardProjectId)).map((c) => c.status)).not.toContain("TODO");
    const tasks = await listProjectTasks(boardProjectId);
    for (const id of [task.id, early.id]) {
      expect(tasks.find((t) => t.id === id)).toMatchObject({ status: "IN_PROGRESS" });
    }
  });
});

describe("competências", () => {
  it("cada um grava as próprias; outros integrantes não veem", async () => {
    actAs(member);
    const saved = await createSkill(member.user.id!, { technologies: ["Java", "JWT"], activityType: "BACKEND", level: 4 }, []);
    expect(saved).toEqual([{ id: 1, userId: member.user.id, technologies: ["Java", "JWT"], activityType: "BACKEND", level: 4 }]);
    actAs(manager);
    await expectStatus(listUserSkills(member.user.id!), 403);
  });
});

describe("IA (com ou sem o provedor externo configurado)", () => {
  let taskId: number;

  beforeAll(async () => {
    actAs(manager);
    const created = await createTask({ title: "Tela de login", status: "TODO", priority: "MEDIUM", technologies: ["Java"], projectId });
    taskId = created.id;
  });

  it("membro consulta o assistente e recebe texto com fontes", async () => {
    actAs(member);
    const answer = await askAssistant(projectId, "Quais tarefas estão pendentes?");
    expect(answer.text.length).toBeGreaterThan(0);
    expect(answer.sources.length).toBeGreaterThan(0);
    if (answer.fallback) expect(answer.notice).toBeTruthy();
  });

  it("resumo e gargalos são do gerente; membro recebe 403", async () => {
    actAs(manager);
    expect((await getSummary(projectId, { start: "2026-01-01", end: "2026-12-31" })).text).toBeTruthy();
    await expectStatus(getSummary(projectId, { start: "2026-01-01" }), 400);
    expect((await getBottlenecks(projectId)).sources.some((s) => s.type === "INDICATORS")).toBe(true);
    actAs(member);
    await expectStatus(getSummary(projectId), 403);
  });

  it("recomendação: AJUSTADA atribui o integrante escolhido", async () => {
    actAs(manager);
    const result = await recommendAssignees(taskId);
    expect(result.items.length).toBeGreaterThanOrEqual(2);
    expect(result.items.every((i) => i.score >= 0 && i.score <= 100)).toBe(true);
    const decided = await registerDecision({
      taskId,
      recommendationId: result.recommendationId,
      decision: "ADJUSTED",
      chosenUserId: member.user.id,
    });
    expect(decided).toMatchObject({ decision: "ADJUSTED", chosenUserId: member.user.id });
    expect((await getTask(taskId)).assigneeId).toBe(member.user.id);
  });

  it("descrição e sugestão de dependências respondem para a tarefa salva", async () => {
    actAs(manager);
    expect((await generateDescription(taskId, 'Gere uma descrição para a tarefa "Tela de login".')).text).toBeTruthy();
    const deps = await suggestDependencies(taskId);
    expect(deps.answer.text).toBeTruthy();
    expect(deps.suggestions.every((s) => s.taskId !== taskId)).toBe(true);
  });

  it("documentos do projeto podem ser listados pela equipe", async () => {
    actAs(member);
    expect(Array.isArray(await listDocuments(projectId))).toBe(true);
  });
});

describe.skipIf(!ADMIN_EMAIL || !ADMIN_PASSWORD)("perfil Administrador", () => {
  it("lê a configuração de domínio e não abre projetos dos quais não participa", async () => {
    const admin = await login({ email: ADMIN_EMAIL!, password: ADMIN_PASSWORD! });
    expect(admin.user.roles).toContain("ADMIN");
    actAs(admin);
    const domain = await getDomain();
    expect(typeof domain.rules).toBe("string");
    // Fora da equipe, nem o administrador abre o projeto.
    await expectStatus(getProject(projectId), 403);
    actAs(member);
    await expectStatus(getDomain(), 403);
  });
});
