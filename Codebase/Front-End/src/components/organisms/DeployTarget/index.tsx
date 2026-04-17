"use client";

import { useState } from "react";
import { Server } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useUpdateDeployTarget } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project.types";

type DeployTargetValue = "docker" | "coolify";

interface DeployTargetProps {
  project: Project;
  canManage: boolean;
}

const OPTIONS: { value: DeployTargetValue; label: string; description: string }[] = [
  {
    value: "docker",
    label: "Local Docker",
    description: "Deploy using Docker on the VPS directly managed by RDeploy.",
  },
  {
    value: "coolify",
    label: "Coolify",
    description: "Deploy via a connected Coolify instance. Coolify must be configured in Admin settings.",
  },
];

export function DeployTarget({ project, canManage }: DeployTargetProps) {
  const currentTarget = (project.deployTarget ?? "docker") as DeployTargetValue;
  const [selected, setSelected] = useState<DeployTargetValue>(currentTarget);
  const [isDirty, setIsDirty] = useState(false);

  const mutation = useUpdateDeployTarget(project.id);

  function handleSelect(value: DeployTargetValue) {
    setSelected(value);
    setIsDirty(value !== currentTarget);
  }

  function handleSave() {
    mutation.mutate(selected, {
      onSuccess: () => {
        setIsDirty(false);
      },
    });
  }

  function handleCancel() {
    setSelected(currentTarget);
    setIsDirty(false);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Deploy Target</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const isActive = selected === option.value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={!canManage || mutation.isPending}
              onClick={() => handleSelect(option.value)}
              className={cn(
                "flex flex-col gap-1 rounded-lg border p-4 text-left transition-colors",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background",
                isActive
                  ? "border-primary bg-primary/10"
                  : "border-border bg-background hover:bg-muted/20",
                (!canManage || mutation.isPending) && "cursor-not-allowed opacity-60"
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "h-3.5 w-3.5 rounded-full border-2 shrink-0",
                    isActive ? "border-primary bg-primary" : "border-muted-foreground"
                  )}
                />
                <span className="text-sm font-medium text-foreground">{option.label}</span>
              </div>
              <p className="pl-5 text-xs text-muted-foreground">{option.description}</p>
            </button>
          );
        })}
      </div>

      {!canManage && (
        <p className="text-xs text-muted-foreground">
          You do not have permission to change the deploy target.
        </p>
      )}

      {canManage && isDirty && (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCancel}
            disabled={mutation.isPending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
