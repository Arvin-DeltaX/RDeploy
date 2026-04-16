"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth.store";
import { ROUTES } from "@/constants/routes";

export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuthStore();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.push(ROUTES.LOGIN);
      return;
    }
    if (user?.mustChangePassword) {
      router.push(ROUTES.CHANGE_PASSWORD);
    }
  }, [token, user, router]);

  if (!token) return null;
  if (user?.mustChangePassword) return null;

  return <>{children}</>;
}
