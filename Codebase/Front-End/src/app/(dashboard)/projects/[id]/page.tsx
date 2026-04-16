"use client";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Users, ExternalLink } from "lucide-react";
import { useProject } from "@/hooks/useProjects";
import { useAuthStore } from "@/store/auth.store";
import { Spinner } from "@/components/atoms/Spinner";
import { Button } from "@/components/atoms/Button";
import { EmptyState } from "@/components/molecules/EmptyState";
import { HealthBadge } from "@/components/molecules/HealthBadge";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS } from "@/constants/status";
import { ROUTES } from "@/constants/routes";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const { data: project, isLoading, isError } = useProject(id);

  const isAdmin = user?.platformRole === "owner" || user?.platformRole === "admin";

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError || !project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project does not exist or you do not have access."
      />
    );
  }

  const statusLabel = STATUS_LABELS[project.status] ?? project.status;
  const statusColor = STATUS_COLORS[project.status] ?? STATUS_COLORS.pending;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">{project.name}</h1>
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                statusColor
              )}
            >
              {statusLabel}
            </span>
            {project.status === "running" && <HealthBadge status={project.healthStatus} />}
          </div>
          <p className="text-sm text-muted-foreground">
            Team:{" "}
            <Link
              href={ROUTES.TEAM_DETAIL(project.team.id)}
              className="text-foreground hover:underline"
            >
              {project.team.name}
            </Link>
          </p>
        </div>

        {(isAdmin) && (
          <Link href={ROUTES.PROJECT_MEMBERS(id)}>
            <Button variant="outline" size="sm">
              <Users className="h-4 w-4" />
              Manage Members
            </Button>
          </Link>
        )}
      </div>

      {/* Project Info */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Project Details
        </h2>

        <dl className="space-y-3">
          <div className="flex items-start gap-2">
            <dt className="w-36 shrink-0 text-sm text-muted-foreground">Slug</dt>
            <dd className="text-sm text-foreground font-mono">{project.slug}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-36 shrink-0 text-sm text-muted-foreground">Repository</dt>
            <dd className="flex items-center gap-1.5 text-sm">
              <a
                href={project.repoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline truncate"
              >
                {project.repoUrl}
              </a>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-36 shrink-0 text-sm text-muted-foreground">Dockerfile</dt>
            <dd className="text-sm text-foreground font-mono">{project.dockerfilePath}</dd>
          </div>
          <div className="flex items-start gap-2">
            <dt className="w-36 shrink-0 text-sm text-muted-foreground">Status</dt>
            <dd>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                  statusColor
                )}
              >
                {statusLabel}
              </span>
            </dd>
          </div>
          {project.status === "running" && (
            <div className="flex items-start gap-2">
              <dt className="w-36 shrink-0 text-sm text-muted-foreground">Health</dt>
              <dd>
                <HealthBadge status={project.healthStatus} />
              </dd>
            </div>
          )}
          {project.port && (
            <div className="flex items-start gap-2">
              <dt className="w-36 shrink-0 text-sm text-muted-foreground">Port</dt>
              <dd className="text-sm text-foreground font-mono">{project.port}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Live URL placeholder */}
      {project.status === "running" && project.team && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-400">Project is live</p>
          <a
            href={`https://${project.slug}-${project.team.slug}.deltaxs.co`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5 text-sm text-green-300 hover:underline"
          >
            {project.slug}-{project.team.slug}.deltaxs.co
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Deploy logs placeholder */}
      {project.deployLogs && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Deploy Logs
          </h2>
          <pre className="rounded-lg border border-border bg-black/40 p-4 text-xs text-green-400 overflow-x-auto max-h-64 overflow-y-auto whitespace-pre-wrap">
            {project.deployLogs}
          </pre>
        </div>
      )}
    </div>
  );
}
