import { describe, expect, it } from "vitest";
import { toProject, toProjectRequest } from "@/features/projects/mappers";
import { taskToInput, toColumn, toColumns, toTask, toTaskRequest } from "@/features/tasks/mappers";
import { dependentsOf, resolveColumns, statusKeyFromName } from "@/features/tasks/board";
import { validateAttachment } from "@/features/tasks/components/TaskActivity";
import { toAttachment, toComment, toHistoryEntry } from "@/features/tasks/mappers";
import { toSkillItems, toSkills } from "@/features/skills/services/skillService";
import * as sample from "./backendSamples";

describe("conversão entre o JSON do backend e o modelo do frontend", () => {
  it("converte ProjetoResponseDTO em Project", () => {
    expect(
      toProject({
        id: 1,
        nome: "APS",
        descricao: "Desc",
        arquivado: true,
        criadorId: 2,
        gerenteId: 2,
        equipe: [{ id: 2, username: "ana", email: "ana@ex.com" }],
        equipeIds: [2],
        tarefasIds: [5],
        createdAt: "2026-11-17T00:00:00Z",
        meuPapelNoProjeto: "ROLE_GERENTE",
        podeGerenciar: true,
        podeAdicionarMembros: true,
      }),
    ).toEqual({
      id: 1,
      name: "APS",
      description: "Desc",
      archived: true,
      creatorId: 2,
      managerId: 2,
      team: [{ id: 2, username: "ana", email: "ana@ex.com" }],
      teamIds: [2],
      taskIds: [5],
      createdAt: "2026-11-17T00:00:00Z",
      myRole: "MANAGER",
      canManage: true,
      canAddMembers: true,
    });
  });

  it("lê o projeto real como gerente e como membro", () => {
    expect(toProject(sample.projectAsManager)).toMatchObject({ managerId: 2, myRole: "MANAGER", canManage: true });
    expect(toProject(sample.projectAsMember)).toMatchObject({
      myRole: "MEMBER",
      canManage: false,
      canAddMembers: false,
      teamIds: [1, 2, 3],
    });
  });

  it("envia gerenteId apenas para transferir a gerência", () => {
    expect(toProjectRequest({ name: "APS", managerId: 3 })).toMatchObject({ gerenteId: 3 });
    expect(toProjectRequest({ name: "APS" }).gerenteId).toBeUndefined();
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

  it("converte a tarefa real com os campos estendidos (complexidade 1–5)", () => {
    const task = toTask(sample.task);
    expect(task).toMatchObject({
      requirements: "r",
      technologies: ["Java", "JWT"],
      status: "TODO",
      complexity: 4,
      dueDate: "2026-12-01",
      assigneeId: null,
      dependencyIds: [],
    });
    expect(toTask({ ...sample.task, complexidade: 9 }).complexity).toBeNull();
    expect(toTaskRequest(taskToInput({ ...task, assigneeId: 3 }, { status: "DONE" }))).toEqual({
      titulo: "API login",
      conteudo: undefined,
      requisitos: "r",
      tecnologias: ["Java", "JWT"],
      status: "CONCLUIDA",
      prioridade: "ALTA",
      complexidade: 4,
      prazo: "2026-12-01",
      responsavelId: 3,
      projetoId: 1,
    });
  });

  it("converte comentários, anexos e histórico reais", () => {
    expect(toComment(sample.comment)).toEqual({
      id: 1, content: "Olá", author: { id: 3, username: null }, createdAt: sample.comment.criadoEm,
    });
    expect(toAttachment(sample.attachment)).toMatchObject({ fileName: "a.txt", size: 8, uploadedBy: { id: 3 } });
    expect(sample.history.map(toHistoryEntry)).toEqual([
      { id: 1, action: "CRIACAO", actorId: 2, assigneeId: null, status: "TODO", createdAt: sample.history[0].criadoEm },
      { id: 3, action: "STATUS", actorId: 3, assigneeId: null, status: "IN_PROGRESS", createdAt: sample.history[1].criadoEm },
    ]);
  });

  it("agrupa competências por atividade e nível e desfaz o agrupamento ao salvar", () => {
    const items = [
      ...sample.skills,
      { tecnologia: "Spring", tipoAtividade: "BACKEND", nivel: 4 },
      { tecnologia: "React", tipoAtividade: "FRONTEND", nivel: 2 },
    ];
    const grouped = toSkills(items, 3);
    expect(grouped).toEqual([
      { id: 1, userId: 3, technologies: ["Java", "Spring"], activityType: "BACKEND", level: 4 },
      { id: 2, userId: 3, technologies: ["React"], activityType: "FRONTEND", level: 2 },
    ]);
    expect(toSkillItems(grouped)).toEqual(items);
  });

  it("identifica colunas personalizadas", () => {
    expect(toColumn({ id: 1, nome: "A fazer", status: "PENDENTE" }, 0)).toMatchObject({ status: "TODO", custom: false });
    expect(toColumn({ id: 2, nome: "Revisão", status: null, posicao: 5 }, 1)).toMatchObject({
      status: "COLUNA_2",
      order: 5,
      custom: true,
    });
  });

  it("ordena as colunas do quadro e usa o status repetido só na primeira", () => {
    const columns = toColumns([
      { id: 3, nome: "Feito", posicao: 2, status: "CONCLUIDA" },
      { id: 1, nome: "A fazer", posicao: 0, status: "PENDENTE" },
      { id: 2, nome: "Backlog", posicao: 1, status: "PENDENTE" },
    ]);
    expect(columns.map((c) => [c.id, c.status])).toEqual([
      [1, "TODO"],
      [2, "COLUNA_2"],
      [3, "DONE"],
    ]);
  });

  it("envia a coluna da tarefa e mantém o status real em coluna sem status", () => {
    const input = { title: "T", status: "COLUNA_7", baseStatus: "IN_PROGRESS", priority: "LOW" as const, projectId: 1 };
    expect(toTaskRequest(input, { id: 7, apiStatus: null })).toMatchObject({ status: "EM_ANDAMENTO", colunaId: 7 });
    expect(toTaskRequest({ ...input, status: "DONE" }, { id: 8, apiStatus: "CONCLUIDA" })).toMatchObject({
      status: "CONCLUIDA",
      colunaId: 8,
    });
    expect(toTaskRequest({ ...input, status: "DONE" })).not.toHaveProperty("colunaId");
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
