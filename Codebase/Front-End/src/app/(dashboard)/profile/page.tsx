"use client";
import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth.store";
import { useConnectGitHub, useDisconnectGitHub, useRefreshUser, useUpdateNotifications } from "@/hooks/useAuth";
import { Switch } from "@/components/atoms/Switch";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import { Badge } from "@/components/atoms/Badge";
import { Button } from "@/components/atoms/Button";
import { Spinner } from "@/components/atoms/Spinner";
import { formatDate } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";

const roleVariantMap = {
  owner: "success",
  admin: "warning",
  user: "secondary",
} as const;

export default function ProfilePage() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();
  const router = useRouter();

  const connectMutation = useConnectGitHub();
  const disconnectMutation = useDisconnectGitHub();
  const refreshUser = useRefreshUser();
  const updateNotifications = useUpdateNotifications();

  // Handle OAuth callback query params
  useEffect(() => {
    const githubParam = searchParams.get("github");
    const errorParam = searchParams.get("error");

    if (githubParam === "connected") {
      toast.success("GitHub account connected successfully");
      // Refresh user data from backend to get updated githubUsername
      refreshUser.mutate();
      // Clean up URL
      router.replace(ROUTES.PROFILE);
    } else if (errorParam) {
      const errorMessages: Record<string, string> = {
        github_state_invalid: "GitHub connection failed — invalid state. Please try again.",
        github_already_linked:
          "This GitHub account is already linked to another user.",
        github_connect_failed: "GitHub connection failed. Please try again.",
      };
      toast.error(errorMessages[errorParam] ?? "GitHub connection failed.");
      router.replace(ROUTES.PROFILE);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!user) return null;

  const isConnected = Boolean(user.githubId);

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
        </div>

        {/* GitHub Connect Section */}
        <div className="border-t border-border pt-5 space-y-3">
          <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
            GitHub
          </p>

          {isConnected ? (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <svg
                  className="h-5 w-5 text-foreground"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                <span className="text-sm text-foreground font-medium">
                  @{user.githubUsername}
                </span>
                <Badge variant="success">Connected</Badge>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <>
                    <Spinner className="h-3 w-3" />
                    Disconnecting...
                  </>
                ) : (
                  "Disconnect"
                )}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Connect your GitHub account to deploy from private repositories.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => connectMutation.mutate()}
                disabled={connectMutation.isPending}
                className="shrink-0"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                </svg>
                Connect GitHub
              </Button>
            </div>
          )}
        </div>

        {/* Notifications Section */}
        <div className="border-t border-border pt-5 space-y-3">
          <p className="text-muted-foreground text-xs uppercase tracking-wider font-medium">
            Notifications
          </p>
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <label
                htmlFor="email-notifications"
                className="text-sm font-medium text-foreground cursor-pointer"
              >
                Email notifications
              </label>
              <p className="text-xs text-muted-foreground">
                Receive emails on deploy success and failure
              </p>
            </div>
            <Switch
              id="email-notifications"
              checked={user.emailNotifications}
              onCheckedChange={(checked) => updateNotifications.mutate(checked)}
              disabled={updateNotifications.isPending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Emails are sent to your account email on deploy success or failure for projects you&apos;re assigned to.
          </p>
        </div>

        <p className="text-xs text-muted-foreground border-t border-border pt-4">
          Profile editing is not available yet. Contact your platform admin to update your details.
        </p>
      </div>
    </div>
  );
}
