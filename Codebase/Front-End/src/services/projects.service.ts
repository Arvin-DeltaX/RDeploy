import api from "@/lib/api";
import type { Project, EnvVar } from "@/types/project.types";
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

export async function cloneRepo(projectId: string): Promise<{ project: Project; envKeys: string[] }> {
  const res = await api.post<{ data: { project: Project; envKeys: string[] } }>(`/api/projects/${projectId}/clone`);
  return res.data.data;
}

export async function getEnvVars(projectId: string): Promise<EnvVar[]> {
  const res = await api.get<{ data: { envVars: EnvVar[] } }>(`/api/projects/${projectId}/env`);
  return res.data.data.envVars;
}

export interface UpdateEnvVarsPayload {
  id: string;
  value: string;
  isSecret: boolean;
}

export async function updateEnvVars(
  projectId: string,
  vars: UpdateEnvVarsPayload[]
): Promise<{ updated: number }> {
  const res = await api.put<{ data: { updated: number } }>(`/api/projects/${projectId}/env`, { vars });
  return res.data.data;
}

export type DeployResult =
  | { project: Project }
  | { warning: true; localhostKeys: string[] };

export async function deployProject(
  projectId: string,
  confirmed?: boolean
): Promise<DeployResult> {
  const res = await api.post<{ data: DeployResult }>(
    `/api/projects/${projectId}/deploy`,
    confirmed !== undefined ? { confirmed } : {}
  );
  return res.data.data;
}

export async function redeployProject(projectId: string): Promise<{ project: Project }> {
  const res = await api.post<{ data: { project: Project } }>(`/api/projects/${projectId}/redeploy`);
  return res.data.data;
}

export async function stopProject(projectId: string): Promise<{ message: string }> {
  const res = await api.post<{ data: { message: string } }>(`/api/projects/${projectId}/stop`);
  return res.data.data;
}

export async function getDeployLogs(projectId: string): Promise<{ logs: string }> {
  const res = await api.get<{ data: { logs: string } }>(`/api/projects/${projectId}/logs`);
  return res.data.data;
}

export interface ContainerStatus {
  running: boolean;
  exitCode: number;
  restartCount: number;
  startedAt: string;
}

export async function getContainerStatus(projectId: string): Promise<ContainerStatus> {
  const res = await api.get<{ data: ContainerStatus }>(`/api/projects/${projectId}/container-status`);
  return res.data.data;
}

export async function uploadEnvFile(projectId: string, file: File): Promise<{ updated: number }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post<{ data: { updated: number } }>(
    `/api/projects/${projectId}/env/upload`,
    formData,
    { headers: { "Content-Type": "multipart/form-data" } }
  );
  return res.data.data;
}
