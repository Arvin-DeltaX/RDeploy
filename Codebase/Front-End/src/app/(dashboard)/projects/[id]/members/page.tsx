"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserPlus } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useProject, useProjectMembers, useAssignProjectMembers, useRemoveProjectMember } from "@/hooks/useProjects";
import { useTeam } from "@/hooks/useTeams";
import { useUsers } from "@/hooks/useUsers";
import { AssignMemberModal } from "@/components/organisms/AssignMemberModal";
import { ProjectMemberList } from "@/components/organisms/ProjectMemberList";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { EmptyState } from "@/components/molecules/EmptyState";
import { ROUTES } from "@/constants/routes";

export default function ProjectMembersPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuthStore();
  const [assignOpen, setAssignOpen] = useState(false);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);

  const { data: project, isLoading: projectLoading } = useProject(id);
  const { data: members, isLoading: membersLoading } = useProjectMembers(id);
  const isAdmin = user?.platformRole === "owner" || user?.platformRole === "admin";
  const { data: allUsers } = useUsers(isAdmin);
  const { data: teamData } = useTeam(project?.teamId ?? "");

  const assignMembers = useAssignProjectMembers(id);
  const removeMember = useRemoveProjectMember(id);

  const currentUserTeamMember = teamData?.team.members.find((m) => m.userId === user?.id);
  const isLeader = currentUserTeamMember?.role === "leader";
  const canManage = isAdmin || isLeader;

  const assignedMemberIds = new Set((members ?? []).map((m) => m.id));
  const availableUsers = (allUsers ?? []).filter((u) => !assignedMemberIds.has(u.id));

  function handleAssign(userId: string) {
    assignMembers.mutate([userId], {
      onSuccess: () => setAssignOpen(false),
    });
  }

  function handleRemove(userId: string) {
    setRemovingUserId(userId);
    removeMember.mutate(userId, {
      onSettled: () => setRemovingUserId(null),
    });
  }

  if (projectLoading || membersLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!project) {
    return (
      <EmptyState
        title="Project not found"
        description="This project does not exist or you do not have access."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={ROUTES.PROJECT_DETAIL(id)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">Project Members</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">{project.name}</p>
        </div>
        {canManage && (
          <Button onClick={() => setAssignOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Assign Member
          </Button>
        )}
      </div>

      {!members || members.length === 0 ? (
        <EmptyState
          title="No members assigned"
          description={
            canManage
              ? "Assign team members to this project."
              : "No members are assigned to this project."
          }
        />
      ) : (
        <ProjectMemberList
          members={members}
          canRemove={canManage}
          onRemove={handleRemove}
          removingUserId={removingUserId}
        />
      )}

      {canManage && (
        <AssignMemberModal
          open={assignOpen}
          onOpenChange={setAssignOpen}
          onSubmit={handleAssign}
          users={availableUsers}
          loading={assignMembers.isPending}
        />
      )}
    </div>
  );
}
