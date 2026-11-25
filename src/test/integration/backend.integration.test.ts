/**
 * Testes de integração contra o backend real (Spring). Usam os mesmos serviços e
 * mapeadores das telas, então validam o contrato de ponta a ponta: rotas, DTOs,
 * códigos de erro e permissões por perfil.
 *
 * Execução: com o backend rodando, `pnpm test:integration`.
 *   BACKEND_URL            padrão http://localhost:8080
 *   BACKEND_ADMIN_EMAIL    opcional; habilita os cenários do Administrador
 *   BACKEND_ADMIN_PASSWORD (usuário criado pelo DataInitializer do backend)
 */
import axios from "axios";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { session } from "@/lib/session";
import { getAiErrorKind, getErrorMessage, isUnavailable } from "@/lib/apiError";
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
import {
  createTask,
  deleteTask,
  listColumns,
  listProjectTasks,
  moveTask,
  updateTask,
} from "@/features/tasks/services/taskService";
import { taskToInput } from "@/features/tasks/mappers";
import type { Task } from "@/features/tasks/types";
import { listUserSkills } from "@/features/skills/services/skillService";
import { askAssistant, recommendAssignees } from "@/features/ai/services/aiService";

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
    throw new Error(
      `Backend indisponível em ${BACKEND_URL}. Suba o backend ou defina BACKEND_URL.`,
    );
  }
  manager = await register(credentials("gerente"));
  member = await register(credentials("membro"));
  outsider = await register(credentials("externo"));
});

afterAll(async () => {
  if (!manager) return;
  actAs(manager);
  for (const id of createdProjects) {
    await api.delete(endpoints.projects.byId(id)).catch(() => undefined);
  }
  session.clear();
});

describe("autenticação", () => {
  it("cadastro devolve token e usuário com perfil Membro", () => {
    expect(manager.token.split(".")).toHaveLength(3);
    expect(manager.user.id).toEqual(expect.any(Number));
    expect(manager.user.email).toBe(credentials("gerente").email);
    expect(manager.user.roles).toEqual(["MEMBER"]);
  });

  it("login com as mesmas credenciais funciona", async () => {
    const result = await login({
      email: credentials("gerente").email,
      password: "senha123",
    });
    expect(result.user.id).toBe(manager.user.id);
  });

  it("senha errada gera 401 com mensagem amigável", async () => {
    const error = await expectStatus(
      login({ email: credentials("gerente").email, password: "errada" }),
      401,
    );
    expect(getErrorMessage(error, "fallback")).toMatch(/inválid/i);
  });

  it("e-mail já cadastrado é recusado", async () => {
    const error = await register(credentials("gerente")).catch((err: unknown) => err);
    expect(axios.isAxiosError(error)).toBe(true);
    expect(getErrorMessage(error, "fallback")).not.toBe("fallback");
  });

  it("requisição sem token é bloqueada", async () => {
    session.clear();
    const response = await axios.get(`${BACKEND_URL}/api/projetos`, {
      adapter: "http",
      validateStatus: () => true,
    });
    expect([401, 403]).toContain(response.status);
  });
});

describe("projetos e permissões por perfil", () => {
  beforeAll(async () => {
    actAs(manager);
    const project = await createProject({
      name: `Projeto integração ${runId}`,
      description: "Criado pelos testes de integração",
      teamIds: [member.user.id!],
    });
    projectId = project.id;
    createdProjects.push(project.id);
  });

  it("criador vê o projeto como Gerente e pode gerenciar", async () => {
    actAs(manager);
    const project = await getProject(projectId);
    expect(project.myRole).toBe("MANAGER");
    expect(project.canManage).toBe(true);
    expect(project.teamIds).toEqual(
      expect.arrayContaining([manager.user.id, member.user.id]),
    );
    const permissions = getProjectPermissions(project, manager.user);
    expect(permissions.canManageColumns).toBe(true);
    expect(permissions.canDeleteTasks).toBe(true);
  });

  it("membro da equipe vê o projeto, mas não gerencia", async () => {
    actAs(member);
    const project = await getProject(projectId);
    expect(project.myRole).toBe("MEMBER");
    expect(project.canManage).toBe(false);
    const permissions = getProjectPermissions(project, member.user);
    expect(permissions.canEditTasks).toBe(true);
    expect(permissions.canDeleteTasks).toBe(false);
    expect(permissions.canDecideAssignment).toBe(false);

    await expectStatus(updateProject(projectId, { name: "Invasão" }), 403);
    await expectStatus(archiveProject(projectId), 403);
  });

  it("usuário fora da equipe não lista nem abre o projeto", async () => {
    actAs(outsider);
    const projects = await listProjects();
    expect(projects.map((p) => p.id)).not.toContain(projectId);
    const error = await expectStatus(getProject(projectId), 403);
    expect(getErrorMessage(error, "fallback")).not.toBe("fallback");
  });

  it("projeto arquivado fica somente leitura e pode ser desarquivado", async () => {
    actAs(manager);
    const archived = await archiveProject(projectId);
    expect(archived.archived).toBe(true);
    expect(getProjectPermissions(archived, manager.user).canEditTasks).toBe(false);
    await expectStatus(updateProject(projectId, { name: "Editar arquivado" }), 409);
    const restored = await unarchiveProject(projectId);
    expect(restored.archived).toBe(false);
  });

  it("projeto inexistente retorna 404", async () => {
    actAs(manager);
    await expectStatus(getProject(99_999_999), 404);
  });
});

describe("quadro e tarefas", () => {
  it("cria, move entre colunas, edita e exclui uma tarefa", async () => {
    actAs(manager);
    const task = await createTask({
      title: "Tarefa de integração",
      content: "Descrição",
      status: "TODO",
      priority: "HIGH",
      projectId,
    });
    expect(task).toMatchObject({ title: "Tarefa de integração", status: "TODO", priority: "HIGH" });

    const moved = await moveTask(task, "IN_PROGRESS");
    expect(moved.status).toBe("IN_PROGRESS");

    const edited = await updateTask(
      task.id,
      taskToInput(moved, { title: "Tarefa editada", priority: "URGENT" }),
    );
    expect(edited).toMatchObject({ title: "Tarefa editada", priority: "URGENT", status: "IN_PROGRESS" });

    const tasks = await listProjectTasks(projectId);
    expect(tasks.map((t) => t.id)).toContain(task.id);

    await deleteTask(task.id);
    const after = await listProjectTasks(projectId);
    expect(after.map((t) => t.id)).not.toContain(task.id);
  });

  it("criar tarefa nunca sobrescreve uma tarefa existente", async () => {
    // Regressão: o backend já copiou `projetoId` para o `id` da nova tarefa
    // (ModelMapper), sobrescrevendo a tarefa cujo id coincidia com o id do
    // projeto. Para reproduzir, avança a sequência que estiver atrás (tarefas
    // ou projetos) até existir uma tarefa com o mesmo id de um projeto nosso.
    actAs(manager);
    const tasks: Task[] = [];
    const projects = [projectId];
    try {
      let match: Task | undefined;
      for (let i = 0; i < 40 && !match; i++) {
        const lastTask = tasks[tasks.length - 1]?.id ?? -1;
        if (lastTask < projects[projects.length - 1]) {
          tasks.push(await createTask({ title: `Existente ${i}`, status: "TODO", priority: "LOW", projectId }));
        } else {
          const extra = await createProject({ name: `Auxiliar ${runId} ${i}` });
          createdProjects.push(extra.id);
          projects.push(extra.id);
        }
        match = tasks.find((task) => projects.includes(task.id));
      }
      expect(match, "não foi possível alinhar as sequências de id").toBeDefined();

      const fresh = await createTask({ title: "Nova", status: "TODO", priority: "LOW", projectId: match!.id });
      tasks.push(fresh);
      expect(fresh.id).not.toBe(match!.id);
      const stillThere = (await listProjectTasks(projectId)).find((task) => task.id === match!.id);
      expect(stillThere?.title).toBe(match!.title);
    } finally {
      for (const task of tasks) await deleteTask(task.id).catch(() => undefined);
    }
  });

  it("título vazio é recusado pela validação do backend", async () => {
    actAs(manager);
    const error = await expectStatus(
      createTask({ title: "", status: "TODO", priority: "LOW", projectId }),
      400,
    );
    expect(getErrorMessage(error, "fallback")).not.toBe("fallback");
  });
});

describe("recursos opcionais ainda não implementados no backend", () => {
  // A interface trata essas respostas como "recurso indisponível" (colunas
  // padrão, aviso de IA indisponível etc.) em vez de quebrar.
  it("colunas personalizadas e competências caem no modo indisponível", async () => {
    actAs(manager);
    const columns = await listColumns(projectId).catch((err: unknown) => err);
    if (Array.isArray(columns)) return; // já implementado no backend
    expect(isUnavailable(columns)).toBe(true);

    const skills = await listUserSkills(manager.user.id!).catch((err: unknown) => err);
    if (Array.isArray(skills)) return;
    expect(isUnavailable(skills)).toBe(true);
  });

  it("falhas da IA são classificadas como indisponibilidade", async () => {
    actAs(manager);
    for (const call of [
      () => recommendAssignees(1),
      () => askAssistant(projectId, "Quais tarefas estão atrasadas?"),
    ]) {
      const result = await call().catch((err: unknown) => err);
      if (!(result instanceof Error)) continue; // já implementado no backend
      expect(getAiErrorKind(result)).toBe("unavailable");
    }
  });
});

describe.skipIf(!ADMIN_EMAIL || !ADMIN_PASSWORD)("perfil Administrador", () => {
  it("vê e gerencia projetos dos quais não participa", async () => {
    const admin = await login({ email: ADMIN_EMAIL!, password: ADMIN_PASSWORD! });
    expect(admin.user.roles).toContain("ADMIN");
    actAs(admin);
    const project = await getProject(projectId);
    expect(project.canManage).toBe(true);
    const permissions = getProjectPermissions(project, admin.user);
    expect(permissions.canEditSkillsOf(member.user.id!)).toBe(true);
    const renamed = await updateProject(projectId, {
      name: `Projeto integração ${runId} (admin)`,
      description: project.description ?? undefined,
    });
    expect(renamed.name).toContain("(admin)");
  });
});
