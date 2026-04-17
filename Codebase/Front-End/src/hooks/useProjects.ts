import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import * as projectsService from "@/services/projects.service";
import type {
  CreateProjectPayload,
  UpdateEnvVarsPayload,
  UpdateResourceLimitsPayload,
} from "@/services/projects.service";
import type { AxiosErrorLike } from "@/types/api.types";
import type { ProjectStatus } from "@/types/project.types";
import { ROUTES } from "@/constants/routes";

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

const ACTIVE_STATUSES: ProjectStatus[] = ["building", "cloning"];

export function useProject(id: string) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => projectsService.getProject(id),
    enabled: !!id,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_STATUSES.includes(status) ? 2000 : false;
    },
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

export function useRdeployYml(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["rdeployYml", projectId],
    queryFn: () => projectsService.getRdeployYml(projectId),
    enabled: !!projectId && enabled,
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

export function useDeployProject(projectId: string) {
  return useMutation({
    mutationFn: (confirmed?: boolean) => projectsService.deployProject(projectId, confirmed),
  });
}

export function useRedeployProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsService.redeployProject(projectId),
    onSuccess: () => {
      toast.success("Redeployment started");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Redeploy failed");
    },
  });
}

export function useStopProject(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsService.stopProject(projectId),
    onSuccess: () => {
      toast.success("Container stopped");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to stop container");
    },
  });
}

export function useDeployLogs(projectId: string) {
  return useQuery({
    queryKey: ["deployLogs", projectId],
    queryFn: () => projectsService.getDeployLogs(projectId),
    enabled: !!projectId,
  });
}

export function useContainerStatus(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["containerStatus", projectId],
    queryFn: () => projectsService.getContainerStatus(projectId),
    enabled: !!projectId && enabled,
    refetchInterval: enabled ? 30000 : false,
  });
}

export function useDeployHistory(projectId: string) {
  return useQuery({
    queryKey: ["deployHistory", projectId],
    queryFn: () => projectsService.getDeployHistory(projectId),
    enabled: !!projectId,
  });
}

export function useRollbackDeploy(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deployId: string) => projectsService.rollbackDeploy(projectId, deployId),
    onSuccess: () => {
      toast.success("Rollback successful");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      void queryClient.invalidateQueries({ queryKey: ["deployHistory", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Rollback failed");
    },
  });
}

export function useWebhookInfo(projectId: string) {
  return useQuery({
    queryKey: ["webhook", projectId],
    queryFn: () => projectsService.getWebhookInfo(projectId),
    enabled: !!projectId,
  });
}

export function useSetupWebhook(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsService.setupWebhook(projectId),
    onSuccess: () => {
      toast.success("Webhook configured successfully");
      void queryClient.invalidateQueries({ queryKey: ["webhook", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to configure webhook");
    },
  });
}

export function useDeleteWebhook(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => projectsService.deleteWebhook(projectId),
    onSuccess: () => {
      toast.success("Webhook disabled");
      void queryClient.invalidateQueries({ queryKey: ["webhook", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to disable webhook");
    },
  });
}

export function useUpdateReplicaCount(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (replicaCount: number) =>
      projectsService.updateReplicaCount(projectId, replicaCount),
    onSuccess: () => {
      toast.success("Replica count saved");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to save replica count");
    },
  });
}

export function useUpdateResourceLimits(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateResourceLimitsPayload) =>
      projectsService.updateResourceLimits(projectId, data),
    onSuccess: () => {
      toast.success("Resource limits saved");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to save resource limits");
    },
  });
}

export function useUpdateCustomDomain(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (customDomain: string | null) =>
      projectsService.updateCustomDomain(projectId, customDomain),
    onSuccess: () => {
      toast.success("Custom domain updated");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to update custom domain");
    },
  });
}

export function useUploadEnvFile(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => projectsService.uploadEnvFile(projectId, file),
    onSuccess: (data) => {
      toast.success(`Uploaded ${data.updated} environment variable(s)`);
      void queryClient.invalidateQueries({ queryKey: ["envVars", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to upload env file");
    },
  });
}

export function useUpdateDeployTarget(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deployTarget: "docker" | "coolify") =>
      projectsService.updateDeployTarget(projectId, deployTarget),
    onSuccess: () => {
      toast.success("Deploy target updated");
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to update deploy target");
    },
  });
}

export function useTransferProject(projectId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: (targetTeamId: string) =>
      projectsService.transferProject(projectId, targetTeamId),
    onSuccess: (data) => {
      toast.success("Project transferred successfully");
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      void queryClient.invalidateQueries({ queryKey: ["teams"] });
      router.push(ROUTES.TEAM_DETAIL(data.teamId));
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to transfer project");
    },
  });
}
