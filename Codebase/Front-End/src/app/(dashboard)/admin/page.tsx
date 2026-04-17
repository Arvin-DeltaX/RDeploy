"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { useAuthStore } from "@/store/auth.store";
import { useUsers, useCreateUser, useUpdateUserRole, useDeleteUser } from "@/hooks/useUsers";
import { CreateUserModal } from "@/components/organisms/CreateUserModal";
import { ConfirmDialog } from "@/components/molecules/ConfirmDialog";
import { Button } from "@/components/atoms/Button";
import { Badge } from "@/components/atoms/Badge";
import { Select } from "@/components/atoms/Select";
import { Spinner } from "@/components/atoms/Spinner";
import { EmptyState } from "@/components/molecules/EmptyState";
import { UserAvatar } from "@/components/molecules/UserAvatar";
import { formatDate } from "@/lib/utils";
import { ROUTES } from "@/constants/routes";
import type { PlatformRole, User } from "@/types/user.types";

const roleVariantMap = {
  owner: "success",
  admin: "warning",
  user: "secondary",
} as const;

export default function AdminPage() {
  const { user: currentUser } = useAuthStore();
  const router = useRouter();

  const isAdmin =
    currentUser?.platformRole === "owner" || currentUser?.platformRole === "admin";

  if (!isAdmin) {
    router.replace(ROUTES.DASHBOARD);
    return null;
  }

  return <AdminContent />;
}

function AdminContent() {
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const { data: users, isLoading, isError } = useUsers();
  const createUser = useCreateUser();
  const updateRole = useUpdateUserRole();
  const deleteUser = useDeleteUser();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage platform users and roles.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner />
        </div>
      ) : isError ? (
        <EmptyState
          title="Failed to load users"
          description="There was an error loading users. Please refresh the page."
        />
      ) : !users || users.length === 0 ? (
        <EmptyState
          title="No users found"
          description="Create the first user to get started."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">User</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Joined</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-muted/10">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                      <span className="font-medium text-foreground">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Badge variant={roleVariantMap[user.platformRole]}>
                        {user.platformRole}
                      </Badge>
                      <Select
                        value={user.platformRole}
                        onChange={(e) =>
                          updateRole.mutate({
                            id: user.id,
                            platformRole: e.target.value as PlatformRole,
                          })
                        }
                        className="w-24 h-7 text-xs"
                        disabled={updateRole.isPending}
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                        <option value="owner">owner</option>
                      </Select>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteTarget(user)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(values) => {
          createUser.mutate(values, { onSuccess: () => setCreateOpen(false) });
        }}
        loading={createUser.isPending}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete User"
        description={`Permanently delete ${deleteTarget?.name ?? "this user"}? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) {
            deleteUser.mutate(deleteTarget.id, {
              onSuccess: () => setDeleteTarget(null),
            });
          }
        }}
        loading={deleteUser.isPending}
      />
    </div>
  );
}
