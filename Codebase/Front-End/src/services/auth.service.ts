import api from "@/lib/api";
import type { User } from "@/types/user.types";

export interface LoginResponse {
  token: string;
  user: User;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await api.post<{ data: LoginResponse }>("/api/auth/login", { email, password });
  return res.data.data;
}

export async function getMe(): Promise<User> {
  const res = await api.get<{ data: { user: User } }>("/api/auth/me");
  return res.data.data.user;
}

export async function getGitHubAuthUrl(): Promise<string> {
  const res = await api.get<{ data: { url: string } }>("/api/auth/github");
  return res.data.data.url;
}

export async function disconnectGitHub(): Promise<void> {
  await api.delete("/api/auth/github");
}

export async function updateNotificationPreferences(
  emailNotifications: boolean
): Promise<boolean> {
  const res = await api.put<{ data: { emailNotifications: boolean } }>(
    "/api/auth/notifications",
    { emailNotifications }
  );
  return res.data.data.emailNotifications;
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  await api.post("/api/auth/change-password", { currentPassword, newPassword });
}
