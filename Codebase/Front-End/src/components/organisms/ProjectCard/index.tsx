import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/atoms/Badge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS, HEALTH_COLORS } from "@/constants/status";
import { ROUTES } from "@/constants/routes";
import type { ProjectWithTeam } from "@/services/projects.service";

interface ProjectCardProps {
  project: ProjectWithTeam;
}

export function ProjectCard({ project }: ProjectCardProps) {
  const statusColor = STATUS_COLORS[project.status] ?? STATUS_COLORS.pending;
  const statusLabel = STATUS_LABELS[project.status] ?? project.status;
  const healthColor = HEALTH_COLORS[project.healthStatus] ?? HEALTH_COLORS.unknown;

  return (
    <Link
      href={ROUTES.PROJECT_DETAIL(project.id)}
      className="block rounded-lg border border-border bg-card p-4 transition-colors hover:border-border/80 hover:bg-card/80"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-foreground">{project.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{project.team.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {project.status === "running" && (
            <span className={cn("flex items-center gap-1 text-xs font-medium", healthColor)}>
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {project.healthStatus === "healthy"
                ? "Healthy"
                : project.healthStatus === "unhealthy"
                ? "Unhealthy"
                : "Unknown"}
            </span>
          )}
          <span
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
              statusColor
            )}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
        <p className="truncate text-xs text-muted-foreground">{project.repoUrl}</p>
      </div>
    </Link>
  );
}
