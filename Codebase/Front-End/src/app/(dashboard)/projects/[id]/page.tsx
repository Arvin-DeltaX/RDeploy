"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Users, ExternalLink, GitBranch } from "lucide-react";
import {
  useProject,
  useCloneRepo,
  useEnvVars,
  useUpdateEnvVars,
  useDeployProject,
  useStopProject,
  useRedeployProject,
  useRdeployYml,
} from "@/hooks/useProjects";
import { useTeam } from "@/hooks/useTeams";
import { useAuthStore } from "@/store/auth.store";
import { Spinner } from "@/components/atoms/Spinner";
import { Button } from "@/components/atoms/Button";
import { EmptyState } from "@/components/molecules/EmptyState";
import { HealthBadge } from "@/components/molecules/HealthBadge";
import { EnvVarsForm } from "@/components/organisms/EnvVarsForm";
import { DeployButton } from "@/components/organisms/DeployButton";
import { ContainerStatusBar } from "@/components/organisms/ContainerStatusBar";
import { LogsViewer } from "@/components/organisms/LogsViewer";
import { DeployHistory } from "@/components/organisms/DeployHistory";
import { WebhookSetup } from "@/components/organisms/WebhookSetup";
import { TransferProject } from "@/components/organisms/TransferProject";
import { MonorepoSuggestions } from "@/components/organisms/MonorepoSuggestions";
import { CustomDomain } from "@/components/organisms/CustomDomain";
import { ResourceLimits } from "@/components/organisms/ResourceLimits";
import { DeployTarget } from "@/components/organisms/DeployTarget";
import { ReplicaManager } from "@/components/organisms/ReplicaManager";
import { cn } from "@/lib/utils";
import { STATUS_LABELS, STATUS_COLORS } from "@/constants/status";
import { ROUTES } from "@/constants/routes";
import type { AxiosErrorLike } from "@/types/api.types";
import type { RdeployYmlResult } from "@/types/project.types";

const RDEPLOY_DOMAIN = process.env.NEXT_PUBLIC_RDEPLOY_DOMAIN ?? "deltaxs.co";

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { data: project, isLoading, isError } = useProject(id);

  const isAdmin = user?.platformRole === "owner" || user?.platformRole === "admin";
  const { data: teamData } = useTeam(project?.teamId ?? "");
  const currentUserTeamMember = teamData?.team.members.find((m) => m.userId === user?.id);
  const teamRole = currentUserTeamMember?.role;
  const isLeader = teamRole === "leader";
  const canManageMembers = isAdmin || isLeader;
  const canEditEnv = isAdmin || teamRole === "leader" || teamRole === "elder";
  const canClone = isAdmin || isLeader;
  const canDeploy = isAdmin || isLeader;

  const cloneMutation = useCloneRepo(id);
  const { data: envVars = [] } = useEnvVars(id);
  const updateEnvMutation = useUpdateEnvVars(id);
  const deployMutation = useDeployProject(id);
  const stopMutation = useStopProject(id);
  const redeployMutation = useRedeployProject(id);

  const [cloneError, setCloneError] = useState<string | null>(null);
  const [localhostKeys, setLocalhostKeys] = useState<string[]>([]);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);
  const [cloneRdeployYml, setCloneRdeployYml] = useState<RdeployYmlResult | null>(null);

  const isNotPending = !!project && project.status !== "pending";
  const { data: fetchedRdeployYml } = useRdeployYml(id, isNotPending);

  function handleClone() {
    setCloneError(null);
    setCloneRdeployYml(null);
    cloneMutation.mutate(undefined, {
      onSuccess: (result) => {
        if (result.rdeployYml?.found && result.rdeployYml.services.length > 1) {
          setCloneRdeployYml(result.rdeployYml);
        }
      },
      onError: (error: unknown) => {
        const err = error as AxiosErrorLike;
        setCloneError(err.response?.data?.error ?? "Failed to connect repository.");
      },
    });
  }

  function handleDeploy() {
    setMissingKeys([]);
    deployMutation.mutate(undefined, {
      onSuccess: (result) => {
        if ("warning" in result && result.warning) {
          setLocalhostKeys(result.localhostKeys);
        } else {
          toast.success("Deployment started");
          void queryClient.invalidateQueries({ queryKey: ["projects", id] });
        }
      },
      onError: (error: unknown) => {
        const err = error as AxiosErrorLike;
        if (err.response?.data?.missingKeys) {
          setMissingKeys(err.response.data.missingKeys);
        }
        toast.error(err.response?.data?.error ?? "Deploy failed");
      },
    });
  }

  function handleConfirmLocalhost() {
    setLocalhostKeys([]);
    deployMutation.mutate(true, {
      onSuccess: (result) => {
        if ("warning" in result && result.warning) {
          // should not happen after confirmation
          setLocalhostKeys(result.localhostKeys);
        } else {
          toast.success("Deployment started");
          void queryClient.invalidateQueries({ queryKey: ["projects", id] });
        }
      },
      onError: (error: unknown) => {
        const err = error as AxiosErrorLike;
        toast.error(err.response?.data?.error ?? "Deploy failed");
      },
    });
  }

  function handleCancelLocalhost() {
    setLocalhostKeys([]);
  }

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
  const isCloning = project.status === "cloning" || cloneMutation.isPending;
  const showConnectRepo =
    canClone && (project.status === "pending" || project.status === "failed");
  const showEnvVars = project.status !== "pending";

  const activeRdeployYml = cloneRdeployYml ?? (fetchedRdeployYml?.found ? fetchedRdeployYml : null);
  const showMonorepoSuggestions =
    activeRdeployYml !== null &&
    activeRdeployYml.found &&
    activeRdeployYml.services.length > 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            {isCloning && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Spinner />
                Connecting repository...
              </span>
            )}
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

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {showConnectRepo && (
            <Button
              size="sm"
              onClick={handleClone}
              disabled={cloneMutation.isPending}
            >
              <GitBranch className="h-4 w-4" />
              {cloneMutation.isPending ? "Connecting..." : "Connect Repo"}
            </Button>
          )}

          {canManageMembers && (
            <Link href={ROUTES.PROJECT_MEMBERS(id)}>
              <Button variant="outline" size="sm">
                <Users className="h-4 w-4" />
                Manage Members
              </Button>
            </Link>
          )}

          <DeployButton
            projectId={id}
            status={project.status}
            canDeploy={canDeploy}
            onDeploy={handleDeploy}
            onStop={() => stopMutation.mutate()}
            onRedeploy={() => redeployMutation.mutate()}
            isDeploying={deployMutation.isPending}
            isStopping={stopMutation.isPending}
            isRedeploying={redeployMutation.isPending}
            missingKeys={missingKeys}
            localhostWarning={localhostKeys}
            onConfirmLocalhostWarning={handleConfirmLocalhost}
            onCancelLocalhostWarning={handleCancelLocalhost}
          />
        </div>
      </div>

      {/* Container status bar */}
      {project.status === "running" && (
        <ContainerStatusBar
          projectId={id}
          status={project.status}
          healthStatus={project.healthStatus}
          port={project.port}
        />
      )}

      {/* Clone error */}
      {cloneError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm font-medium text-red-400">Connection failed</p>
          <p className="mt-0.5 text-sm text-red-300">{cloneError}</p>
        </div>
      )}

      {/* Monorepo suggestions */}
      {showMonorepoSuggestions && (
        <MonorepoSuggestions
          teamId={project.teamId}
          repoUrl={project.repoUrl}
          services={activeRdeployYml!.services}
        />
      )}

      {/* Project Info */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Project Details
        </h2>

        <dl className="space-y-3">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
            <dt className="sm:w-36 shrink-0 text-sm text-muted-foreground">Slug</dt>
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
          {project.port !== null && (
            <div className="flex items-start gap-2">
              <dt className="w-36 shrink-0 text-sm text-muted-foreground">Port</dt>
              <dd className="text-sm text-foreground font-mono">{project.port}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Live URL */}
      {project.status === "running" && project.team && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
          <p className="text-sm font-medium text-green-400">Project is live</p>
          <a
            href={`https://${project.slug}-${project.team.slug}.${RDEPLOY_DOMAIN}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-1.5 text-sm text-green-300 hover:underline"
          >
            {project.slug}-{project.team.slug}.{RDEPLOY_DOMAIN}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* Environment Variables */}
      {showEnvVars && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Environment Variables
          </h2>
          <EnvVarsForm
            envVars={envVars}
            canEdit={canEditEnv}
            onSave={(vars) => updateEnvMutation.mutate(vars)}
            isSaving={updateEnvMutation.isPending}
          />
        </div>
      )}

      {/* Logs */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Logs
        </h2>
        <LogsViewer projectId={id} status={project.status} />
      </div>

      {/* Deploy History */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Deploy History
        </h2>
        <DeployHistory projectId={id} canRollback={canDeploy} />
      </div>

      {/* Resource Limits */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Resource Limits
        </h2>
        <ResourceLimits project={project} canEdit={canEditEnv} />
      </div>

      {/* Deploy Target */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Deploy Target
        </h2>
        <DeployTarget project={project} canManage={canDeploy} />
      </div>

      {/* Replicas */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Replicas
        </h2>
        <ReplicaManager project={project} canManage={canDeploy} />
      </div>

      {/* Custom Domain */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Custom Domain
        </h2>
        <CustomDomain project={project} canManage={canDeploy} />
      </div>

      {/* Auto Deploy */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Auto Deploy
        </h2>
        <WebhookSetup projectId={id} canManage={canDeploy} />
      </div>

      {/* Transfer Project (Danger Zone) */}
      <TransferProject project={project} canTransfer={isAdmin} />
    </div>
  );
}
