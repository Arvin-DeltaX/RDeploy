"use client";

import { useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { useUpdateReplicaCount } from "@/hooks/useProjects";
import { cn } from "@/lib/utils";
import { STATUS_COLORS, STATUS_LABELS } from "@/constants/status";
import type { Project, ProjectStatus } from "@/types/project.types";

interface ReplicaManagerProps {
  project: Project;
  canManage: boolean;
}

export function ReplicaManager({ project, canManage }: ReplicaManagerProps) {
  const [count, setCount] = useState(project.replicaCount ?? 1);
  const mutation = useUpdateReplicaCount(project.id);

  const isDirty = count !== (project.replicaCount ?? 1);

  function decrement() {
    setCount((prev) => Math.max(1, prev - 1));
  }

  function increment() {
    setCount((prev) => Math.min(5, prev + 1));
  }

  function handleSave() {
    mutation.mutate(count);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Replicas</span>
      </div>

      <div className="flex items-center gap-4">
        {canManage ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={decrement}
              disabled={count <= 1 || mutation.isPending}
              aria-label="Decrease replica count"
              className={cn(
                "h-8 w-8 rounded-md border border-input bg-background",
                "flex items-center justify-center text-sm font-medium text-foreground",
                "hover:bg-accent hover:text-accent-foreground",
                "disabled:pointer-events-none disabled:opacity-50",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              )}
            >
              −
            </button>
            <span className="w-6 text-center text-sm font-semibold text-foreground tabular-nums">
              {count}
            </span>
            <button
              type="button"
              onClick={increment}
              disabled={count >= 5 || mutation.isPending}
              aria-label="Increase replica count"
              className={cn(
                "h-8 w-8 rounded-md border border-input bg-background",
                "flex items-center justify-center text-sm font-medium text-foreground",
                "hover:bg-accent hover:text-accent-foreground",
                "disabled:pointer-events-none disabled:opacity-50",
                "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
              )}
            >
              +
            </button>
          </div>
        ) : (
          <span className="text-sm font-semibold text-foreground tabular-nums">{count}</span>
        )}

        <span className="text-xs text-muted-foreground">of 5 max</span>

        {canManage && isDirty && (
          <Button
            size="sm"
            onClick={handleSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {canManage && (
        <p className="text-xs text-muted-foreground">
          Changes apply on next deploy / redeploy
        </p>
      )}

      {project.replicas && project.replicas.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                  Replica #
                </th>
                <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                  Port
                </th>
                <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {project.replicas.map((replica) => {
                const statusKey = replica.status as ProjectStatus;
                const statusColor = STATUS_COLORS[statusKey] ?? STATUS_COLORS.pending;
                const statusLabel = STATUS_LABELS[statusKey] ?? replica.status;
                return (
                  <tr key={replica.id}>
                    <td className="py-2 pr-4 font-mono text-foreground">
                      {replica.replicaIndex + 1}
                    </td>
                    <td className="py-2 pr-4 font-mono text-foreground">
                      {replica.port ?? <span className="text-muted-foreground italic">—</span>}
                    </td>
                    <td className="py-2">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                          statusColor
                        )}
                      >
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
