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
  createdAt: string;
  updatedAt: string;
}
