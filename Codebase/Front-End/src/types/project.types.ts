export interface RdeployYmlService {
  name: string
  dockerfile: string
  description: string
}

export interface RdeployYmlResult {
  found: boolean
  services: RdeployYmlService[]
}

export type ProjectStatus =
  | "pending"
  | "cloning"
  | "ready"
  | "building"
  | "running"
  | "failed"
  | "stopped";

export type HealthStatus = "healthy" | "unhealthy" | "unknown";

export interface EnvVar {
  id: string;
  key: string;
  isSecret: boolean;
  hasValue: boolean;
}

export interface ProjectReplica {
  id: string;
  replicaIndex: number;
  containerId: string | null;
  port: number | null;
  status: string;
}

export interface Project {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  repoUrl: string;
  dockerfilePath: string;
  status: ProjectStatus;
  healthStatus: HealthStatus;
  port: number | null;
  containerId: string | null;
  restartCount: number;
  exitCode: number | null;
  deployLogs: string | null;
  cpuLimit: string | null;
  memoryLimit: string | null;
  replicaCount: number;
  replicas: ProjectReplica[];
  customDomain: string | null;
  deployTarget: string;
  coolifyAppId: string | null;
  createdAt: string;
  updatedAt: string;
}
