"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChangePassword } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES } from "@/constants/routes";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function ChangePasswordPage() {
  const { token } = useAuthStore();
  const router = useRouter();
  const changePasswordMutation = useChangePassword();

  useEffect(() => {
    if (!token) router.push(ROUTES.LOGIN);
  }, [token, router]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data: FormData) => {
    changePasswordMutation.mutate({
      currentPassword: data.currentPassword,
      newPassword: data.newPassword,
    });
  };

  if (!token) return null;

  return (
    <div className="w-full max-w-sm">
      <div className="rounded-lg border border-border bg-card p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Change Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You must change your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Current Password
            </label>
            <input
              {...register("currentPassword")}
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.currentPassword && (
              <p className="mt-1 text-xs text-destructive">
                {errors.currentPassword.message}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              New Password
            </label>
            <input
              {...register("newPassword")}
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.newPassword && (
              <p className="mt-1 text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              Confirm Password
            </label>
            <input
              {...register("confirmPassword")}
              type="password"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {errors.confirmPassword && (
              <p className="mt-1 text-xs text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={changePasswordMutation.isPending}
            className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
