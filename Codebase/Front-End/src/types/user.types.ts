export type PlatformRole = "owner" | "admin" | "user";

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  platformRole: PlatformRole;
  mustChangePassword: boolean;
  githubId: string | null;
  githubUsername: string | null;
  createdAt: string;
  updatedAt: string;
}
