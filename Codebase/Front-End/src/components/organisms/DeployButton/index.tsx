"use client";

import { Rocket, Square, RefreshCw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/project.types";

interface DeployButtonProps {
  projectId: string;
  status: ProjectStatus;
  canDeploy: boolean;
  onDeploy: () => void;
  onStop: () => void;
  onRedeploy: () => void;
  isDeploying: boolean;
  isStopping: boolean;
  isRedeploying: boolean;
  missingKeys?: string[];
  localhostWarning?: string[];
  onConfirmLocalhostWarning: () => void;
  onCancelLocalhostWarning: () => void;
}

export function DeployButton({
  status,
  canDeploy,
  onDeploy,
  onStop,
  onRedeploy,
  isDeploying,
  isStopping,
  isRedeploying,
  missingKeys = [],
  localhostWarning = [],
  onConfirmLocalhostWarning,
  onCancelLocalhostWarning,
}: DeployButtonProps) {
  const isActive = isDeploying || isStopping || isRedeploying;
  const isBuilding = status === "building" || status === "cloning";
  const isRunning = status === "running";
  const canInitialDeploy = status === "ready" || status === "failed" || status === "stopped";

  if (!canDeploy) return null;

  return (
    <div className="flex flex-col gap-2">
      {/* Missing keys error */}
      {missingKeys.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-red-400">
            <AlertTriangle className="h-4 w-4" />
            Missing environment variables
          </p>
          <ul className="mt-1 ml-5 list-disc text-sm text-red-300">
            {missingKeys.map((key) => (
              <li key={key} className="font-mono text-xs">
                {key}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Localhost warning confirm dialog */}
      <ConfirmDialog
        open={localhostWarning.length > 0}
        onOpenChange={(open) => {
          if (!open) onCancelLocalhostWarning();
        }}
        title="Localhost values detected"
        description={`The following environment variables appear to reference localhost, which will not work inside Docker containers:\n\n${localhostWarning.join(", ")}\n\nDeploy anyway?`}
        confirmLabel="Deploy anyway"
        cancelLabel="Cancel"
        onConfirm={onConfirmLocalhostWarning}
        loading={isDeploying}
      />

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        {(isRunning || isBuilding) && (
          <>
            <Button
              variant="destructive"
              size="sm"
              onClick={onStop}
              disabled={isActive}
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onRedeploy}
              disabled={isActive}
            >
              <RefreshCw className={cn("h-4 w-4", isRedeploying && "animate-spin")} />
              Redeploy
            </Button>
          </>
        )}

        {canInitialDeploy && (
          <Button
            size="sm"
            onClick={onDeploy}
            disabled={isActive || missingKeys.length > 0}
          >
            <Rocket className="h-4 w-4" />
            {isDeploying ? "Deploying..." : "Deploy"}
          </Button>
        )}

        {isBuilding && (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Spinner />
            Building...
          </span>
        )}
      </div>
    </div>
  );
}
