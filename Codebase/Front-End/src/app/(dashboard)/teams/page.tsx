"use client";
import { useState } from "react";
import Link from "next/link";
import { Plus, Users, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useTeams, useCreateTeam, useDeleteTeam } from "@/hooks/useTeams";
import { CreateTeamModal } from "@/components/organisms/CreateTeamModal";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { EmptyState } from "@/components/molecules/EmptyState";
import { formatDate } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import type { Team } from "@/types/team.types";

export default function TeamsPage() {
  const { user } = useAuthStore();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Team | null>(null);

  const { data: teams, isLoading } = useTeams();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();

  const isAdmin =
    user?.platformRole === "owner" || user?.platformRole === "admin";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Teams</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage your teams.
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" />
            Create Team
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : !teams || teams.length === 0 ? (
        <EmptyState
          title="No teams yet"
          description={isAdmin ? "Create the first team to get started." : "You are not a member of any team yet."}
          action={
            isAdmin ? (
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" />
                Create Team
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div
              key={team.id}
              className="rounded-lg border border-border bg-card p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <Link
                  href={ROUTES.TEAM_DETAIL(team.id)}
                  className="flex items-center gap-2 flex-1 min-w-0"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary shrink-0">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{team.name}</p>
                    <p className="text-xs text-muted-foreground">{team.slug}</p>
                  </div>
                </Link>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteTarget(team)}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Created {formatDate(team.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <CreateTeamModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(name) => {
          createTeam.mutate(name, { onSuccess: () => setCreateOpen(false) });
        }}
        loading={createTeam.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Team"
        description={`Permanently delete "${deleteTarget?.name ?? ""}"? All projects and members will be removed.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteTeam.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        loading={deleteTeam.isPending}
      />
    </div>
  );
}
