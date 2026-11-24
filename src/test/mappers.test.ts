import { describe, expect, it } from "vitest";
import { toProject, toProjectRequest } from "@/features/projects/mappers";
import { taskToInput, toColumn, toTask, toTaskRequest } from "@/features/tasks/mappers";
import { dependentsOf, resolveColumns, statusKeyFromName } from "@/features/tasks/board";
import { validateAttachment } from "@/features/tasks/components/TaskActivity";

describe("conversão entre o JSON do backend e o modelo do frontend", () => {
  it("converte ProjetoResponseDTO em Project", () => {
    expect(
      toProject({
        id: 1,
        nome: "APS",
        descricao: "Desc",
        arquivado: true,
        criadorId: 2,
        equipe: [{ id: 2, username: "ana", email: "ana@ex.com" }],
        equipeIds: [2],
        tarefasIds: [5],
        createdAt: "2026-11-17T00:00:00Z",
        meuPapelNoProjeto: "ROLE_GERENTE",
        podeGerenciar: true,
      }),
    ).toEqual({
      id: 1,
      name: "APS",
      description: "Desc",
      archived: true,
      creatorId: 2,
      team: [{ id: 2, username: "ana", email: "ana@ex.com" }],
      teamIds: [2],
      taskIds: [5],
      createdAt: "2026-11-17T00:00:00Z",
      myRole: "MANAGER",
      canManage: true,
    });
  });

  it("tolera campos ausentes no JSON de projeto", () => {
    const project = toProject({ id: 1, nome: "APS", arquivado: false, podeGerenciar: false });
    expect(project).toMatchObject({
      description: null,
      creatorId: null,
      team: [],
      teamIds: [],
      taskIds: [],
      myRole: null,
    });
  });

  it("converte Project para ProjetoRequestDTO", () => {
    expect(toProjectRequest({ name: "APS", description: "D", teamIds: [1] })).toEqual({
      nome: "APS",
      descricao: "D",
      equipeIds: [1],
    });
  });

  it("converte tarefas e seus enums nos dois sentidos", () => {
    const task = toTask({
      id: 3,
      titulo: "Login",
      conteudo: null,
      status: "EM_ANDAMENTO",
      prioridade: "URGENTE",
      projetoId: 1,
    });
    expect(task).toMatchObject({
      title: "Login",
      content: null,
      status: "IN_PROGRESS",
      priority: "URGENT",
      projectId: 1,
    });
    expect(
      toTaskRequest({ title: "Login", status: "DONE", priority: "LOW", projectId: 1 }),
    ).toEqual({
      titulo: "Login",
      conteudo: undefined,
      status: "CONCLUIDA",
      prioridade: "BAIXA",
      projetoId: 1,
    });
  });

  it("converte os campos estendidos da tarefa e preserva tudo ao mover", () => {
    const task = toTask({
      id: 4,
      titulo: "Deploy",
      requisitos: "CI verde",
      tecnologias: ["Docker"],
      status: "EM_REVISAO",
      prioridade: "ALTA",
      complexidade: "BAIXA",
      prazo: "2026-12-01T00:00:00",
      responsavel: { id: 9 },
      dependenciasIds: [3],
      projetoId: 1,
    });
    expect(task).toMatchObject({
      requirements: "CI verde",
      technologies: ["Docker"],
      status: "EM_REVISAO",
      complexity: "LOW",
      dueDate: "2026-12-01",
      assigneeId: 9,
      dependencyIds: [3],
    });
    expect(toTaskRequest(taskToInput(task, { status: "DONE" }))).toEqual({
      titulo: "Deploy",
      conteudo: undefined,
      requisitos: "CI verde",
      tecnologias: ["Docker"],
      status: "CONCLUIDA",
      prioridade: "ALTA",
      complexidade: "BAIXA",
      prazo: "2026-12-01",
      responsavelId: 9,
      dependenciasIds: [3],
      projetoId: 1,
    });
  });

  it("identifica colunas personalizadas", () => {
    expect(toColumn({ id: 1, nome: "A fazer", status: "PENDENTE" }, 0)).toMatchObject({ status: "TODO", custom: false });
    expect(toColumn({ id: 2, nome: "Revisão", status: "EM_REVISAO", ordem: 5 }, 1)).toMatchObject({
      status: "EM_REVISAO",
      order: 5,
      custom: true,
    });
  });
});

describe("regras do quadro", () => {
  const base = { title: "", content: null, requirements: null, technologies: [], priority: "LOW" as const,
    complexity: null, dueDate: null, assigneeId: null, projectId: 1 };

  it("cria coluna para status sem coluna e detecta dependentes transitivos", () => {
    const tasks = [
      { ...base, id: 1, status: "TODO", dependencyIds: [] },
      { ...base, id: 2, status: "X", dependencyIds: [1] },
      { ...base, id: 3, status: "TODO", dependencyIds: [2] },
    ];
    expect(resolveColumns([], tasks).map((c) => c.status)).toEqual(["TODO", "X"]);
    expect([...dependentsOf(1, tasks)]).toEqual([2, 3]);
  });

  it("gera chave de status a partir do nome da coluna", () => {
    expect(statusKeyFromName("  Em revisão / QA ")).toBe("EM_REVISAO_QA");
  });

  it("valida tipo e tamanho dos anexos", () => {
    expect(validateAttachment(new File(["a"], "doc.pdf"))).toBe("");
    expect(validateAttachment(new File(["a"], "script.sh"))).toMatch(/não permitido/);
    expect(validateAttachment(new File([], "vazio.txt"))).toMatch(/vazio/);
    const big = new File(["a"], "big.zip");
    Object.defineProperty(big, "size", { value: 11 * 1024 * 1024 });
    expect(validateAttachment(big)).toMatch(/excede/);
  });
});
