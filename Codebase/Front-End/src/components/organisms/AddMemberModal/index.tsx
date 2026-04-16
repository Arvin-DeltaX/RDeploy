"use client";
import * as Dialog from "@radix-ui/react-dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { X } from "lucide-react";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { FormField } from "@/components/molecules/FormField";
import type { User } from "@/types/user.types";
import type { TeamRole } from "@/types/team.types";

const schema = z.object({
  userId: z.string().min(1, "Please select a user"),
  role: z.enum(["leader", "elder", "member"] as const),
});

type FormValues = z.infer<typeof schema>;

interface AddMemberModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (userId: string, role: TeamRole) => void;
  users: User[];
  loading?: boolean;
}

export function AddMemberModal({
  open,
  onOpenChange,
  onSubmit,
  users,
  loading = false,
}: AddMemberModalProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { role: "member" },
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  function onValid(values: FormValues) {
    onSubmit(values.userId, values.role);
    reset();
  }

  return (
    <Dialog.Root open={open} onOpenChange={handleClose}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="text-base font-semibold text-foreground">
              Add Member
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit(onValid)} className="space-y-4">
            <FormField label="User" htmlFor="userId" error={errors.userId?.message}>
              <Select id="userId" {...register("userId")}>
                <option value="">Select a user...</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.email})
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Role" htmlFor="role" error={errors.role?.message}>
              <Select id="role" {...register("role")}>
                <option value="member">Member</option>
                <option value="elder">Elder</option>
                <option value="leader">Leader</option>
              </Select>
            </FormField>

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Member"}
              </Button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
