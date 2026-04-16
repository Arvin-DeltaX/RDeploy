import api from "@/lib/api";
import type { Team, TeamMember, TeamRole } from "@/types/team.types";

export interface TeamWithMembers extends Team {
  members: TeamMember[];
}

export interface TeamDetail {
  team: TeamWithMembers;
}

export async function listTeams(): Promise<Team[]> {
  const res = await api.get<{ data: Team[] }>("/api/teams");
  return res.data.data;
}

export async function getTeam(id: string): Promise<TeamDetail> {
  const res = await api.get<{ data: TeamDetail }>(`/api/teams/${id}`);
  return res.data.data;
}

export async function createTeam(name: string): Promise<Team> {
  const res = await api.post<{ data: Team }>("/api/teams", { name });
  return res.data.data;
}

export async function deleteTeam(id: string): Promise<void> {
  await api.delete(`/api/teams/${id}`);
}

export async function addMember(teamId: string, userId: string, role: TeamRole): Promise<TeamMember> {
  const res = await api.post<{ data: TeamMember }>(`/api/teams/${teamId}/members`, { userId, role });
  return res.data.data;
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  await api.delete(`/api/teams/${teamId}/members/${userId}`);
}
