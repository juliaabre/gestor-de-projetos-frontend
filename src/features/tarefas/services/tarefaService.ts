import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import type { StatusTarefa, Tarefa, TarefaRequest } from "../types";

export async function listarTarefas(): Promise<Tarefa[]> {
  const { data } = await api.get<Tarefa[]>(endpoints.tarefas.base);
  return data;
}

export async function listarTarefasDoProjeto(projetoId: number): Promise<Tarefa[]> {
  const { data } = await api.get<Tarefa[]>(endpoints.tarefas.byProjeto(projetoId));
  return data;
}

export async function buscarTarefa(id: number): Promise<Tarefa> {
  const { data } = await api.get<Tarefa>(endpoints.tarefas.byId(id));
  return data;
}

export async function criarTarefa(body: TarefaRequest): Promise<Tarefa> {
  const { data } = await api.post<Tarefa>(endpoints.tarefas.base, body);
  return data;
}

/** O PUT do backend substitui a tarefa inteira; envie todos os campos. */
export async function atualizarTarefa(id: number, body: TarefaRequest): Promise<Tarefa> {
  const { data } = await api.put<Tarefa>(endpoints.tarefas.byId(id), body);
  return data;
}

/** Atalho para arrastar e soltar entre colunas: reenvia a tarefa com o novo status. */
export async function moverTarefa(tarefa: Tarefa, status: StatusTarefa): Promise<Tarefa> {
  return atualizarTarefa(tarefa.id, {
    titulo: tarefa.titulo,
    conteudo: tarefa.conteudo ?? undefined,
    prioridade: tarefa.prioridade,
    projetoId: tarefa.projetoId,
    status,
  });
}

export async function excluirTarefa(id: number): Promise<void> {
  await api.delete(endpoints.tarefas.byId(id));
}
