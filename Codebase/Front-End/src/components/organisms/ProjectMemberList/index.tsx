import { Trash2 } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import type { User } from "@/types/user.types";

interface ProjectMemberListProps {
  members: User[];
  canRemove: boolean;
  onRemove: (userId: string) => void;
  removingUserId: string | null;
}

export function ProjectMemberList({
  members,
  canRemove,
  onRemove,
  removingUserId,
}: ProjectMemberListProps) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
            {canRemove && (
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {members.map((member) => (
            <tr key={member.id} className="hover:bg-muted/20">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <UserAvatar name={member.name} avatarUrl={member.avatarUrl} />
                  <span className="font-medium text-foreground">{member.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{member.email}</td>
              {canRemove && (
                <td className="px-4 py-3 text-right">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(member.id)}
                    disabled={removingUserId === member.id}
                    className="text-destructive hover:text-destructive"
                  >
                    {removingUserId === member.id ? (
                      <Spinner size="sm" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
