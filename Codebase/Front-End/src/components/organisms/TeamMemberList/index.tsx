"use client";
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { formatDate } from "@/lib/utils";
import type { TeamMember } from "@/types/team.types";

const roleVariantMap = {
  leader: "success",
  elder: "warning",
  member: "secondary",
} as const;

interface TeamMemberListProps {
  members: TeamMember[];
  canRemove: boolean;
  onRemove: (userId: string) => void;
  removingUserId?: string | null;
}

export function TeamMemberList({
  members,
  canRemove,
  onRemove,
  removingUserId,
}: TeamMemberListProps) {
  const [confirmUserId, setConfirmUserId] = useState<string | null>(null);

  const memberToRemove = members.find((m) => m.userId === confirmUserId);

  return (
    <>
      <div className="divide-y divide-border rounded-lg border border-border">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <UserAvatar
                name={member.user?.name ?? "Unknown"}
                avatarUrl={member.user?.avatarUrl}
              />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {member.user?.name ?? "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {member.user?.email} · Joined {formatDate(member.joinedAt)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Badge variant={roleVariantMap[member.role]}>{member.role}</Badge>
              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setConfirmUserId(member.userId)}
                  disabled={removingUserId === member.userId}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={!!confirmUserId}
        onOpenChange={(open) => { if (!open) setConfirmUserId(null); }}
        title="Remove Member"
        description={`Remove ${memberToRemove?.user?.name ?? "this member"} from the team?`}
        confirmLabel="Remove"
        onConfirm={() => {
          if (confirmUserId) {
            onRemove(confirmUserId);
            setConfirmUserId(null);
          }
        }}
        loading={removingUserId === confirmUserId}
      />
    </>
  );
}
