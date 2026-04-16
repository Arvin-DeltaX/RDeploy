import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  login as loginService,
  changePassword as changePasswordService,
} from "@/services/auth.service";
import { useAuthStore } from "@/store/auth.store";
import { ROUTES } from "@/constants/routes";

interface LoginCredentials {
  email: string;
  password: string;
}

interface ChangePasswordCredentials {
  currentPassword: string;
  newPassword: string;
}

interface AxiosErrorLike {
  response?: {
    data?: {
      error?: string;
    };
  };
}

export function useLogin() {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: ({ email, password }: LoginCredentials) =>
      loginService(email, password),
    onSuccess: (data) => {
      setAuth(data.token, data.user);
      if (data.user.mustChangePassword) {
        router.push(ROUTES.CHANGE_PASSWORD);
      } else {
        router.push(ROUTES.DASHBOARD);
      }
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosErrorLike;
      toast.error(axiosError.response?.data?.error ?? "Login failed");
    },
  });
}

export function useLogout() {
  const { logout } = useAuthStore();
  const router = useRouter();

  return () => {
    logout();
    router.push(ROUTES.LOGIN);
  };
}

export function useChangePassword() {
  const router = useRouter();
  const { user, setAuth, token } = useAuthStore();

  return useMutation({
    mutationFn: ({ currentPassword, newPassword }: ChangePasswordCredentials) =>
      changePasswordService(currentPassword, newPassword),
    onSuccess: () => {
      toast.success("Password changed successfully");
      if (user && token) {
        setAuth(token, { ...user, mustChangePassword: false });
      }
      router.push(ROUTES.DASHBOARD);
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosErrorLike;
      toast.error(axiosError.response?.data?.error ?? "Failed to change password");
    },
  });
}
