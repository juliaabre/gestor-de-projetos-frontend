import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";
import { toProject, toProjectRequest } from "../mappers";
import type { Project, ProjectInput, ProjectResponseDto } from "../types";

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<ProjectResponseDto[]>(endpoints.projects.base);
  return data.map(toProject);
}

export async function getProject(id: number): Promise<Project> {
  const { data } = await api.get<ProjectResponseDto>(
    endpoints.projects.byId(id),
  );
  return toProject(data);
}

export async function createProject(input: ProjectInput): Promise<Project> {
  const { data } = await api.post<ProjectResponseDto>(
    endpoints.projects.base,
    toProjectRequest(input),
  );
  return toProject(data);
}

export async function updateProject(
  id: number,
  input: ProjectInput,
): Promise<Project> {
  const { data } = await api.put<ProjectResponseDto>(
    endpoints.projects.byId(id),
    toProjectRequest(input),
  );
  return toProject(data);
}

export async function archiveProject(id: number): Promise<Project> {
  const { data } = await api.patch<ProjectResponseDto>(
    endpoints.projects.archive(id),
  );
  return toProject(data);
}

export async function unarchiveProject(id: number): Promise<Project> {
  const { data } = await api.patch<ProjectResponseDto>(
    endpoints.projects.unarchive(id),
  );
  return toProject(data);
}
