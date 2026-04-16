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
  const res = await api.get<{ data: { projects: ProjectWithTeam[] } }>("/api/projects");
  return res.data.data.projects;
}

export async function listTeamProjects(teamId: string): Promise<Project[]> {
  const res = await api.get<{ data: { projects: Project[] } }>(`/api/teams/${teamId}/projects`);
  return res.data.data.projects;
}

export async function getProject(id: string): Promise<ProjectWithTeam> {
  const res = await api.get<{ data: { project: ProjectWithTeam } }>(`/api/projects/${id}`);
  return res.data.data.project;
}

export async function createProject(teamId: string, payload: CreateProjectPayload): Promise<Project> {
  const res = await api.post<{ data: { project: Project } }>(`/api/teams/${teamId}/projects`, payload);
  return res.data.data.project;
}

export async function deleteProject(id: string): Promise<void> {
  await api.delete(`/api/projects/${id}`);
}

export async function listProjectMembers(projectId: string): Promise<User[]> {
  const res = await api.get<{ data: { members: User[] } }>(`/api/projects/${projectId}/members`);
  return res.data.data.members;
}

export async function assignProjectMembers(projectId: string, userIds: string[]): Promise<void> {
  await api.post(`/api/projects/${projectId}/members`, { userIds });
}

export async function removeProjectMember(projectId: string, userId: string): Promise<void> {
  await api.delete(`/api/projects/${projectId}/members/${userId}`);
}
