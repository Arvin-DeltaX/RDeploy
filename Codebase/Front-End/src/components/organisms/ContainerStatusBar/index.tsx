"use client";

import { HealthBadge } from "@/components/molecules/HealthBadge";
import { useContainerStatus } from "@/hooks/useProjects";
import type { HealthStatus, ProjectStatus } from "@/types/project.types";

interface ContainerStatusBarProps {
  projectId: string;
  status: ProjectStatus;
  healthStatus: HealthStatus;
  port: number | null;
}

function formatUptime(startedAt: string): string {
  const diffMs = Date.now() - new Date(startedAt).getTime();
  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}

export function ContainerStatusBar({
  projectId,
  status,
  healthStatus,
  port,
}: ContainerStatusBarProps) {
  const isRunning = status === "running";
  const { data: containerStatus, isLoading } = useContainerStatus(projectId, isRunning);

  if (!isRunning) return null;
  if (isLoading || !containerStatus) return null;

  return (
    <div className="rounded-lg border border-border bg-card/50 px-4 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
      <HealthBadge status={healthStatus} />

      <span className="text-muted-foreground">
        Up{" "}
        <span className="font-medium text-foreground">
          {formatUptime(containerStatus.startedAt)}
        </span>
      </span>

      <span
        className={
          containerStatus.restartCount > 0
            ? "text-amber-400 font-medium"
            : "text-muted-foreground"
        }
      >
        {containerStatus.restartCount} restart{containerStatus.restartCount !== 1 ? "s" : ""}
      </span>

      {!containerStatus.running && (
        <span className="text-muted-foreground">
          Exit code:{" "}
          <span className="font-mono font-medium text-foreground">
            {containerStatus.exitCode}
          </span>
        </span>
      )}

      {port !== null && (
        <span className="text-muted-foreground">
          Port:{" "}
          <span className="font-mono font-medium text-foreground">{port}</span>
        </span>
      )}
    </div>
  );
}
