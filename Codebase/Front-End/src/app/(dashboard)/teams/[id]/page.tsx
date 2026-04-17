"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { UserPlus, AlertTriangle, Plus } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useTeam, useAddMember, useRemoveMember } from "@/hooks/useTeams";
import { useUsers } from "@/hooks/useUsers";
import { AddMemberModal } from "@/components/organisms/AddMemberModal";
import { TeamMemberList } from "@/components/organisms/TeamMemberList";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ROUTES } from "@/constants/routes";
import type { TeamRole } from "@/types/team.types";

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const { data, isLoading, isError } = useTeam(id);
  const isAdmin =
    user?.platformRole === "owner" || user?.platformRole === "admin";
  const { data: allUsers } = useUsers(isAdmin);
  const addMember = useAddMember();
  const removeMember = useRemoveMember();

  const hasLeader = data?.team.members.some((m) => m.role === "leader") ?? true;
  const currentUserMember = data?.team.members.find((m) => m.userId === user?.id);
  const isLeader = currentUserMember?.role === "leader";
  const canCreateProject = isAdmin || isLeader;

  const existingMemberUserIds = new Set(data?.team.members.map((m) => m.userId) ?? []);
  const availableUsers = (allUsers ?? []).filter(
    (u) => !existingMemberUserIds.has(u.id)
  );

  function handleRemove(userId: string) {
    setRemovingUserId(userId);
    removeMember.mutate(
      { teamId: id, userId },
      { onSettled: () => setRemovingUserId(null) }
    );
  }

  function handleAddMember(userId: string, role: TeamRole) {
    addMember.mutate(
      { teamId: id, userId, role },
      { onSuccess: () => setAddMemberOpen(false) }
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState title="Failed to load team" description="Something went wrong. Please refresh and try again." />
    );
  }

  if (!data) {
    return (
      <EmptyState title="Team not found" description="This team does not exist or you do not have access." />
    );
  }

  const { team } = data;
  const members = team.members;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{team.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">/{team.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          {canCreateProject && (
            <Link href={ROUTES.TEAM_NEW_PROJECT(id)}>
              <Button variant="outline">
                <Plus className="h-4 w-4" />
                New Project
              </Button>
            </Link>
          )}
          {isAdmin && (
            <Button onClick={() => setAddMemberOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Add Member
            </Button>
          )}
        </div>
      </div>

      {!hasLeader && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          This team has no leader. Assign a leader to enable project management.
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Members ({members.length})
        </h2>
        {members.length === 0 ? (
          <EmptyState
            title="No members yet"
            description={isAdmin ? "Add the first member to this team." : "This team has no members."}
          />
        ) : (
          <TeamMemberList
            members={members}
            canRemove={isAdmin}
            onRemove={handleRemove}
            removingUserId={removingUserId}
          />
        )}
      </div>

      {isAdmin && (
        <AddMemberModal
          open={addMemberOpen}
          onOpenChange={setAddMemberOpen}
          onSubmit={handleAddMember}
          users={availableUsers}
          loading={addMember.isPending}
        />
      )}
    </div>
  );
}
