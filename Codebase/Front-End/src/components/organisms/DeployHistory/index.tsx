"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { useDeployHistory, useRollbackDeploy } from "@/hooks/useProjects";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { EmptyState } from "@/components/molecules/EmptyState";
import { Spinner } from "@/components/atoms/Spinner";
import { Button } from "@/components/atoms/Button";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";

interface DeployHistoryProps {
  projectId: string;
  canRollback: boolean;
}

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function DeployHistory({ projectId, canRollback }: DeployHistoryProps) {
  const { data: deploys = [], isLoading } = useDeployHistory(projectId);
  const rollbackMutation = useRollbackDeploy(projectId);
  const [pendingRollbackId, setPendingRollbackId] = useState<string | null>(null);

  function handleRollbackConfirm() {
    if (!pendingRollbackId) return;
    rollbackMutation.mutate(pendingRollbackId, {
      onSettled: () => setPendingRollbackId(null),
    });
  }

  const pendingDeploy = deploys.find((d) => d.id === pendingRollbackId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  }

  if (deploys.length === 0) {
    return (
      <EmptyState
        title="No deploy history"
        description="Deployments will appear here once the project has been deployed."
      />
    );
  }

  return (
    <>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">#</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Deployed At</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden sm:table-cell">
                Deployed By
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground hidden md:table-cell">
                Image Tag
              </th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Status</th>
              {canRollback && (
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Action</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {deploys.map((deploy) => (
              <tr
                key={deploy.id}
                className={cn(
                  "transition-colors",
                  deploy.isActive ? "bg-green-500/5" : "hover:bg-muted/20"
                )}
              >
                <td className="px-4 py-3 font-mono text-foreground">
                  {deploy.deployNumber}
                </td>
                <td className="px-4 py-3 text-foreground">
                  {formatDateTime(deploy.deployedAt)}
                </td>
                <td className="px-4 py-3 text-foreground hidden sm:table-cell">
                  {deploy.deployedBy.name}
                </td>
                <td className="px-4 py-3 font-mono text-muted-foreground hidden md:table-cell truncate max-w-[160px]">
                  {deploy.imageTag}
                </td>
                <td className="px-4 py-3">
                  {deploy.isActive ? (
                    <span className="inline-flex items-center rounded-full border border-green-500/40 bg-green-500/10 px-2.5 py-0.5 text-xs font-semibold text-green-400">
                      Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/30 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                      Inactive
                    </span>
                  )}
                </td>
                {canRollback && (
                  <td className="px-4 py-3 text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deploy.isActive || rollbackMutation.isPending}
                      onClick={() => setPendingRollbackId(deploy.id)}
                    >
                      Rollback
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={!!pendingRollbackId}
        onOpenChange={(open) => { if (!open) setPendingRollbackId(null); }}
        title="Rollback deployment"
        description={
          pendingDeploy
            ? `Roll back to deploy #${pendingDeploy.deployNumber} from ${formatDate(pendingDeploy.deployedAt)}? The project will be restarted using that image.`
            : "Are you sure you want to roll back to this deployment?"
        }
        confirmLabel="Rollback"
        onConfirm={handleRollbackConfirm}
        loading={rollbackMutation.isPending}
      />
    </>
  );
}
