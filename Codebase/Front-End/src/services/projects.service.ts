import api from "@/lib/api";
import type { Project } from "@/types/project.types";
import type { User } from "@/types/user.types";

export interface ProjectWithTeam extends Project {
  team: { id: string; name: string; slug: string };
}

export interface CreateProjectPayload {
  name: string;
  repoUrl: string;
  dockerfilePath?: string;
}

export async function listAllProjects(): Promise<ProjectWithTeam[]> {
  const res = await api.get<{ data: ProjectWithTeam[] }>("/api/projects");
  return res.data.data;
}

export async function listTeamProjects(teamId: string): Promise<Project[]> {
  const res = await api.get<{ data: Project[] }>(`/api/teams/${teamId}/projects`);
  return res.data.data;
}

export async function getProject(id: string): Promise<ProjectWithTeam> {
  const res = await api.get<{ data: ProjectWithTeam }>(`/api/projects/${id}`);
  return res.data.data;
}

export async function createProject(teamId: string, payload: CreateProjectPayload): Promise<Project> {
  const res = await api.post<{ data: Project }>(`/api/teams/${teamId}/projects`, payload);
  return res.data.data;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}

export async function listProjectMembers(projectId: string): Promise<User[]> {
  const res = await api.get<{ data: User[] }>(`/api/projects/${projectId}/members`);
  return res.data.data;
}

export async function assignProjectMembers(projectId: string, userIds: string[]): Promise<void> {
  await api.post(`/api/projects/${projectId}/members`, { userIds });
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await api.delete(`/api/projects/${projectId}/members/${userId}`);
}
