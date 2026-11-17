import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import type { Projeto, ProjetoRequest } from "../types";

export async function listarProjetos(): Promise<Projeto[]> {
  const { data } = await api.get<Projeto[]>(endpoints.projetos.base);
  return data;
}

export async function buscarProjeto(id: number): Promise<Projeto> {
  const { data } = await api.get<Projeto>(endpoints.projetos.byId(id));
  return data;
}

export async function criarProjeto(body: ProjetoRequest): Promise<Projeto> {
  const { data } = await api.post<Projeto>(endpoints.projetos.base, body);
  return data;
}

export async function atualizarProjeto(id: number, body: ProjetoRequest): Promise<Projeto> {
  const { data } = await api.put<Projeto>(endpoints.projetos.byId(id), body);
  return data;
}

export async function excluirProjeto(id: number): Promise<void> {
  await api.delete(endpoints.projetos.byId(id));
}
