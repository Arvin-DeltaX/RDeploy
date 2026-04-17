import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as projectsService from "@/services/projects.service";
import type { CreateProjectPayload, UpdateEnvVarsPayload } from "@/services/projects.service";
import type { AxiosErrorLike } from "@/types/api.types";

export function useAllProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: projectsService.listAllProjects,
  });
}

export function useTeamProjects(teamId: string) {
  return useQuery({
    queryKey: ["projects", "team", teamId],
    queryFn: () => projectsService.listTeamProjects(teamId),
    enabled: !!teamId,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsService.getProject(id),
    enabled: !!id,
  });
}

export function useCreateProject(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateProjectPayload) =>
      projectsService.createProject(teamId, payload),
    onSuccess: () => {
      toast.success("Project created successfully");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to create project");
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsService.deleteProject(id),
    onSuccess: () => {
      toast.success("Project deleted");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to delete project");
    },
  });
}

export function useProjectMembers(projectId: string) {
  return useQuery({
    queryKey: ["projects", projectId, "members"],
    queryFn: () => projectsService.listProjectMembers(projectId),
    enabled: !!projectId,
  });
}

export function useAssignProjectMembers(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userIds: string[]) =>
      projectsService.assignProjectMembers(projectId, userIds),
    onSuccess: () => {
      toast.success("Members assigned");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to assign members");
    },
  });
}

export function useRemoveProjectMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      projectsService.removeProjectMember(projectId, userId),
    onSuccess: () => {
      toast.success("Member removed from project");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId, "members"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to remove member");
    },
  });
}

export function useCloneRepo(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsService.cloneRepo(projectId),
    onSuccess: () => {
      toast.success("Repository connected successfully");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["envVars", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to connect repository");
    },
  });
}

export function useEnvVars(projectId: string) {
  return useQuery({
    queryKey: ["envVars", projectId],
    queryFn: () => projectsService.getEnvVars(projectId),
    enabled: !!projectId,
  });
}

export function useUpdateEnvVars(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (vars: UpdateEnvVarsPayload[]) =>
      projectsService.updateEnvVars(projectId, vars),
    onSuccess: () => {
      toast.success("Environment variables saved");
      void queryClient.invalidateQueries({ queryKey: ["envVars", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to save environment variables");
    },
  });
}
