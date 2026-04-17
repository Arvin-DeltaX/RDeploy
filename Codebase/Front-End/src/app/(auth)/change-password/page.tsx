"use client";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useChangePassword } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth.store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ROUTES } from "@/constants/routes";
import { FormField } from "@/components/molecules/FormField";
import { Input } from "@/components/atoms/Input";
import { Button } from "@/components/atoms/Button";

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
    <div className="w-full max-w-sm px-4 sm:px-0">
      <div className="rounded-lg border border-border bg-card p-6 sm:p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground">Change Password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You must change your password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Current Password"
            htmlFor="currentPassword"
            error={errors.currentPassword?.message}
          >
            <Input
              id="currentPassword"
              type="password"
              {...register("currentPassword")}
            />
          </FormField>

          <FormField
            label="New Password"
            htmlFor="newPassword"
            error={errors.newPassword?.message}
          >
            <Input
              id="newPassword"
              type="password"
              {...register("newPassword")}
            />
          </FormField>

          <FormField
            label="Confirm Password"
            htmlFor="confirmPassword"
            error={errors.confirmPassword?.message}
          >
            <Input
              id="confirmPassword"
              type="password"
              {...register("confirmPassword")}
            />
          </FormField>

          <Button
            type="submit"
            className="w-full"
            disabled={changePasswordMutation.isPending}
          >
            {changePasswordMutation.isPending ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
