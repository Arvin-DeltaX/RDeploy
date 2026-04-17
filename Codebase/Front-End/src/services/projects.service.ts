import api from "@/lib/api";
import type { Project, EnvVar, RdeployYmlResult } from "@/types/project.types";
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

export async function cloneRepo(projectId: string): Promise<{ project: Project; envKeys: string[]; rdeployYml?: RdeployYmlResult }> {
  const res = await api.post<{ data: { project: Project; envKeys: string[]; rdeployYml?: RdeployYmlResult } }>(`/api/projects/${projectId}/clone`);
  return res.data.data;
}

export async function getRdeployYml(projectId: string): Promise<RdeployYmlResult> {
  const res = await api.get<{ data: RdeployYmlResult }>(`/api/projects/${projectId}/rdeploy-yml`);
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

export interface DeployRecord {
  id: string;
  deployNumber: number;
  deployedAt: string;
  isActive: boolean;
  imageTag: string;
  deployedBy: { id: string; name: string };
}

export async function getDeployHistory(projectId: string): Promise<DeployRecord[]> {
  const res = await api.get<{ data: DeployRecord[] }>(`/api/projects/${projectId}/deploys`);
  return res.data.data;
}

export async function rollbackDeploy(projectId: string, deployId: string): Promise<{ message: string }> {
  const res = await api.post<{ data: { message: string } }>(
    `/api/projects/${projectId}/rollback/${deployId}`
  );
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

export interface WebhookInfo {
  webhookUrl: string;
  hasSecret: boolean;
}

export interface WebhookSetupResult {
  webhookSecret: string;
  webhookUrl: string;
}

export async function getWebhookInfo(projectId: string): Promise<WebhookInfo> {
  const res = await api.get<{ data: WebhookInfo }>(`/api/projects/${projectId}/webhook`);
  return res.data.data;
}

export async function setupWebhook(projectId: string): Promise<WebhookSetupResult> {
  const res = await api.post<{ data: WebhookSetupResult }>(`/api/projects/${projectId}/webhook/setup`);
  return res.data.data;
}

export async function deleteWebhook(projectId: string): Promise<void> {
  await api.delete(`/api/projects/${projectId}/webhook`);
}

export interface UpdateResourceLimitsPayload {
  cpuLimit?: string | null;
  memoryLimit?: string | null;
}

export interface ResourceLimitsResult {
  cpuLimit: string | null;
  memoryLimit: string | null;
}

export async function updateReplicaCount(
  projectId: string,
  replicaCount: number
): Promise<{ replicaCount: number }> {
  const res = await api.put<{ data: { replicaCount: number } }>(
    `/api/projects/${projectId}/replicas`,
    { replicaCount }
  );
  return res.data.data;
}

export async function updateResourceLimits(
  projectId: string,
  data: UpdateResourceLimitsPayload
): Promise<ResourceLimitsResult> {
  const res = await api.put<{ data: ResourceLimitsResult }>(
    `/api/projects/${projectId}/resource-limits`,
    data
  );
  return res.data.data;
}

export async function updateCustomDomain(
  projectId: string,
  customDomain: string | null
): Promise<{ customDomain: string | null }> {
  const res = await api.put<{ data: { customDomain: string | null } }>(
    `/api/projects/${projectId}/custom-domain`,
    { customDomain }
  );
  return res.data.data;
}

export interface TransferProjectResult {
  id: string;
  name: string;
  slug: string;
  teamId: string;
}

export async function updateDeployTarget(
  projectId: string,
  deployTarget: "docker" | "coolify"
): Promise<{ deployTarget: string }> {
  const res = await api.put<{ data: { deployTarget: string } }>(
    `/api/projects/${projectId}/deploy-target`,
    { deployTarget }
  );
  return res.data.data;
}

export async function transferProject(
  projectId: string,
  targetTeamId: string
): Promise<TransferProjectResult> {
  const res = await api.post<{ data: TransferProjectResult }>(
    `/api/projects/${projectId}/transfer`,
    { targetTeamId }
  );
  return res.data.data;
}
