"use client";

import { useState } from "react";
import { Cpu } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useUpdateResourceLimits } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/project.types";

interface ResourceLimitsProps {
  project: Project;
  canEdit: boolean;
}

export function ResourceLimits({ project, canEdit }: ResourceLimitsProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [cpuLimit, setCpuLimit] = useState(project.cpuLimit ?? "");
  const [memoryLimit, setMemoryLimit] = useState(project.memoryLimit ?? "");

  const mutation = useUpdateResourceLimits(project.id);

  function handleEdit() {
    setCpuLimit(project.cpuLimit ?? "");
    setMemoryLimit(project.memoryLimit ?? "");
    setIsEditing(true);
  }

  function handleCancel() {
    setIsEditing(false);
    setCpuLimit(project.cpuLimit ?? "");
    setMemoryLimit(project.memoryLimit ?? "");
  }

  function handleSave() {
    mutation.mutate(
      {
        cpuLimit: cpuLimit.trim() === "" ? null : cpuLimit.trim(),
        memoryLimit: memoryLimit.trim() === "" ? null : memoryLimit.trim(),
      },
      {
        onSuccess: () => {
          setIsEditing(false);
        },
      }
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Cpu className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Resource Limits</span>
        </div>
        {canEdit && !isEditing && (
          <Button variant="outline" size="sm" onClick={handleEdit}>
            Edit
          </Button>
        )}
      </div>

      {!isEditing ? (
        <dl className="space-y-3">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <dt className="sm:w-36 shrink-0 text-sm text-muted-foreground">CPU Limit</dt>
            <dd className="text-sm text-foreground font-mono">
              {project.cpuLimit ?? (
                <span className="text-muted-foreground italic">No limit</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-2">
            <dt className="sm:w-36 shrink-0 text-sm text-muted-foreground">Memory Limit</dt>
            <dd className="text-sm text-foreground font-mono">
              {project.memoryLimit ?? (
                <span className="text-muted-foreground italic">No limit</span>
              )}
            </dd>
          </div>
        </dl>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="cpuLimit"
                className="block text-sm font-medium text-foreground"
              >
                CPU Limit
              </label>
              <input
                id="cpuLimit"
                type="text"
                value={cpuLimit}
                onChange={(e) => setCpuLimit(e.target.value)}
                placeholder="e.g. 0.5, 1, 2"
                className={cn(
                  "w-full rounded-md border border-input bg-background px-3 py-2",
                  "text-sm text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                )}
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="memoryLimit"
                className="block text-sm font-medium text-foreground"
              >
                Memory Limit
              </label>
              <input
                id="memoryLimit"
                type="text"
                value={memoryLimit}
                onChange={(e) => setMemoryLimit(e.target.value)}
                placeholder="e.g. 256m, 512m, 1g"
                className={cn(
                  "w-full rounded-md border border-input bg-background px-3 py-2",
                  "text-sm text-foreground placeholder:text-muted-foreground",
                  "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                )}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Changes apply on next deploy / redeploy
          </p>

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
        </div>
      )}
    </div>
  );
}
