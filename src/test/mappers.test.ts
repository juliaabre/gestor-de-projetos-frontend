import { describe, expect, it } from "vitest";
import { toProject, toProjectRequest } from "@/features/projects/mappers";
import { toTask, toTaskRequest } from "@/features/tasks/mappers";

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
});
