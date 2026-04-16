import { cn } from "@/lib/utils";
import { HEALTH_COLORS } from "@/constants/status";
import type { HealthStatus } from "@/types/project.types";

interface HealthBadgeProps {
  status: HealthStatus;
}

const HEALTH_LABELS: Record<HealthStatus, string> = {
  healthy: "Healthy",
  unhealthy: "Unhealthy",
  unknown: "Unknown",
};

export function HealthBadge({ status }: HealthBadgeProps) {
  const color = HEALTH_COLORS[status] ?? HEALTH_COLORS.unknown;
  return (
    <span className={cn("flex items-center gap-1.5 text-sm font-medium", color)}>
      <span className="h-2 w-2 rounded-full bg-current" />
      {HEALTH_LABELS[status]}
    </span>
  );
}
