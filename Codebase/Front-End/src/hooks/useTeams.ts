import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as teamsService from "@/services/teams.service";
import type { TeamRole } from "@/types/team.types";

interface AxiosErrorLike {
  response?: { data?: { error?: string } };
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: teamsService.listTeams,
  });
}

export function useTeam(id: string) {
  return useQuery({
    queryKey: ["teams", id],
    queryFn: () => teamsService.getTeam(id),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => teamsService.createTeam(name),
    onSuccess: () => {
      toast.success("Team created successfully");
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to create team");
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => teamsService.deleteTeam(id),
    onSuccess: () => {
      toast.success("Team deleted");
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to delete team");
    },
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId, role }: { teamId: string; userId: string; role: TeamRole }) =>
      teamsService.addMember(teamId, userId, role),
    onSuccess: (_data, variables) => {
      toast.success("Member added");
      void queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to add member");
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, userId }: { teamId: string; userId: string }) =>
      teamsService.removeMember(teamId, userId),
    onSuccess: (_data, variables) => {
      toast.success("Member removed");
      void queryClient.invalidateQueries({ queryKey: ["teams", variables.teamId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to remove member");
    },
  });
}
