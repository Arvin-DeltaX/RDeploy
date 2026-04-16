import api from "@/lib/api";
import type { User, PlatformRole } from "@/types/user.types";

export interface CreateUserPayload {
  email: string;
  name: string;
  platformRole?: PlatformRole;
}

export async function listUsers(): Promise<User[]> {
  const res = await api.get<{ data: User[] }>("/api/admin/users");
  return res.data.data;
}

export async function createUser(payload: CreateUserPayload): Promise<User> {
  const res = await api.post<{ data: User }>("/api/admin/users", payload);
  return res.data.data;
}

export async function updateUserRole(id: string, platformRole: PlatformRole): Promise<User> {
  const res = await api.put<{ data: User }>(`/api/admin/users/${id}`, { platformRole });
  return res.data.data;
}

export async function deleteUser(id: string): Promise<void> {
  await api.delete(`/api/admin/users/${id}`);
}
