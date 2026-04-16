export type ProjectStatus =
  | "pending"
  | "cloning"
  | "ready"
  | "building"
  | "running"
  | "failed"
  | "stopped";

export type HealthStatus = "healthy" | "unhealthy" | "unknown";

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
