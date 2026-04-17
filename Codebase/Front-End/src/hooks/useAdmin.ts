import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as adminService from "@/services/admin.service";
import type { AxiosErrorLike } from "@/types/api.types";

export function useCoolifyConfig() {
  return useQuery({
    queryKey: ["admin", "coolify"],
    queryFn: adminService.getCoolifyConfig,
  });
}

export function useSetCoolifyConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      coolifyUrl,
      coolifyApiToken,
    }: {
      coolifyUrl: string;
      coolifyApiToken: string;
    }) => adminService.setCoolifyConfig(coolifyUrl, coolifyApiToken),
    onSuccess: () => {
      toast.success("Coolify configuration saved");
      void queryClient.invalidateQueries({ queryKey: ["admin", "coolify"] });
    },
    onError: (error: unknown) => {
      const err = error as AxiosErrorLike;
      toast.error(err.response?.data?.error ?? "Failed to save Coolify configuration");
    },
  });
}
