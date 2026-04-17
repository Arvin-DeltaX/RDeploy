"use client";

import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useTransferProject } from "@/hooks/useProjects";
import { Button } from "@/components/atoms/Button";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import type { Project } from "@/types/project.types";

interface TransferProjectProps {
  project: Project;
  canTransfer: boolean;
}

export function TransferProject({ project, canTransfer }: TransferProjectProps) {
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { data: teams = [] } = useTeams();
  const transferMutation = useTransferProject(project.id);

  if (!canTransfer) return null;

  const eligibleTeams = teams.filter((t) => t.id !== project.teamId);
  const selectedTeam = eligibleTeams.find((t) => t.id === selectedTeamId);

  function handleTransferClick() {
    if (!selectedTeamId) return;
    setConfirmOpen(true);
  }

  function handleConfirm() {
    transferMutation.mutate(selectedTeamId, {
      onSettled: () => setConfirmOpen(false),
    });
  }

  return (
    <>
      <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wider">
            Danger Zone
          </h2>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Transfer Project</p>
          <p className="text-sm text-muted-foreground">
            Move this project to a different team. All member assignments will be removed.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-1.5 flex-1">
            <label
              htmlFor="transfer-team-select"
              className="text-xs text-muted-foreground font-medium"
            >
              Target Team
            </label>
            <select
              id="transfer-team-select"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="">Select a team...</option>
              {eligibleTeams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            variant="destructive"
            size="sm"
            disabled={!selectedTeamId || transferMutation.isPending}
            onClick={handleTransferClick}
            className="shrink-0"
          >
            Transfer
          </Button>
        </div>

        {eligibleTeams.length === 0 && (
          <p className="text-xs text-muted-foreground">
            No other teams available to transfer to.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Transfer Project"
        description={`Transfer "${project.name}" to ${selectedTeam?.name ?? "the selected team"}? All member assignments will be removed.`}
        confirmLabel="Transfer"
        loading={transferMutation.isPending}
        onConfirm={handleConfirm}
      />
    </>
  );
}
