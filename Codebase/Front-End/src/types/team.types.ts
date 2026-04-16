export type TeamRole = "leader" | "elder" | "member";

export interface Team {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  userId: string;
  teamId: string;
  role: TeamRole;
  joinedAt: string;
  user?: import("./user.types").User;
}
