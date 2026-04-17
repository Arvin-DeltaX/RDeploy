import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  login as loginService,
  changePassword as changePasswordService,
  getGitHubAuthUrl,
  disconnectGitHub as disconnectGitHubService,
  getMe,
  updateNotificationPreferences,
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

export function useConnectGitHub() {
  return useMutation({
    mutationFn: () => getGitHubAuthUrl(),
    onSuccess: (url) => {
      // Redirect the browser to the GitHub OAuth authorization page
      window.location.href = url;
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosErrorLike;
      toast.error(axiosError.response?.data?.error ?? "Failed to start GitHub connection");
    },
  });
}

export function useRefreshUser() {
  const { token, setAuth } = useAuthStore();

  return useMutation({
    mutationFn: () => getMe(),
    onSuccess: (freshUser) => {
      if (token) setAuth(token, freshUser);
    },
  });
}

export function useDisconnectGitHub() {
  const { user, token, setAuth } = useAuthStore();

  return useMutation({
    mutationFn: () => disconnectGitHubService(),
    onSuccess: () => {
      if (user && token) {
        setAuth(token, {
          ...user,
          githubId: null,
          githubUsername: null,
        });
      }
      toast.success("GitHub account disconnected");
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosErrorLike;
      toast.error(
        axiosError.response?.data?.error ?? "Failed to disconnect GitHub"
      );
    },
  });
}

export function useUpdateNotifications() {
  const { user, token, setAuth } = useAuthStore();

  return useMutation({
    mutationFn: (emailNotifications: boolean) =>
      updateNotificationPreferences(emailNotifications),
    onSuccess: (emailNotifications) => {
      if (user && token) {
        setAuth(token, { ...user, emailNotifications });
      }
      toast.success("Notification preference saved");
    },
    onError: (error: unknown) => {
      const axiosError = error as AxiosErrorLike;
      toast.error(
        axiosError.response?.data?.error ?? "Failed to update notifications"
      );
    },
  });
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
