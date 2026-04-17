import api from "@/lib/api";

export interface CoolifyConfig {
  coolifyUrl: string | null;
  tokenIsSet: boolean;
}

export async function getCoolifyConfig(): Promise<CoolifyConfig> {
  const res = await api.get<{ data: CoolifyConfig }>("/api/admin/coolify");
  return res.data.data;
}

export async function setCoolifyConfig(
  coolifyUrl: string,
  coolifyApiToken: string
): Promise<CoolifyConfig> {
  const res = await api.put<{ data: CoolifyConfig }>("/api/admin/coolify", {
    coolifyUrl,
    coolifyApiToken,
  });
  return res.data.data;
}
