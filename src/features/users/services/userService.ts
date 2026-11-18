import { api } from "@/lib/axios";
import { endpoints } from "@/lib/endpoints";

export interface UserSummary {
  id: number;
  username: string;
  email: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function listUsers(token?: string): Promise<UserSummary[]> {
  const { data } = await api.get<UserSummary[]>(
    endpoints.users.base,
    token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  );
  return data;
}

export async function getUser(id: number): Promise<UserSummary> {
  const { data } = await api.get<UserSummary>(endpoints.users.byId(id));
  return data;
}

export async function findUserByEmail(
  email: string,
  token?: string,
): Promise<UserSummary | null> {
  const users = await listUsers(token);
  const target = email.toLowerCase();
  return users.find((user) => user.email?.toLowerCase() === target) ?? null;
}
