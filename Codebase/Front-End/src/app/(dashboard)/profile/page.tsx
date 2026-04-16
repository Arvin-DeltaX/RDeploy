"use client";
import { useAuthStore } from "@/store/auth.store";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import { Badge } from "@/components/atoms/Badge";
import { formatDate } from "@/lib/utils";

const roleVariantMap = {
  owner: "success",
  admin: "warning",
  user: "secondary",
} as const;

export default function ProfilePage() {
  const { user } = useAuthStore();

  if (!user) return null;

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your account details.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-6">
        <div className="flex items-center gap-4">
          <UserAvatar name={user.name} avatarUrl={user.avatarUrl} className="h-16 w-16 text-lg" />
          <div>
            <p className="text-lg font-semibold text-foreground">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
              Platform Role
            </p>
            <Badge variant={roleVariantMap[user.platformRole]}>{user.platformRole}</Badge>
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
              Member Since
            </p>
            <p className="text-foreground">{formatDate(user.createdAt)}</p>
          </div>

          {user.githubUsername && (
            <div className="space-y-1 col-span-2">
              <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
                GitHub
              </p>
              <p className="text-foreground">@{user.githubUsername}</p>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Profile editing is not available yet. Contact your platform admin to update your details.
        </p>
      </div>
    </div>
  );
}
