import prisma from "../lib/prisma";
import { encrypt, decrypt } from "../utils/encryption";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CoolifyConfig {
  coolifyUrl: string;
  coolifyApiToken: string;
}

interface CoolifyAppResponse {
  uuid: string;
  status?: string;
  [key: string]: unknown;
}

// A Project shape that carries what we need from the Prisma Project model
interface ProjectForCoolify {
  id: string;
  name: string;
  slug: string;
  repoUrl: string;
  dockerfilePath: string;
  coolifyAppId: string | null;
  team: {
    slug: string;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loadConfig(): Promise<CoolifyConfig> {
  const config = await prisma.platformConfig.findUnique({
    where: { id: "singleton" },
  });

  if (!config || !config.coolifyUrl || !config.coolifyApiToken) {
    throw new Error("Coolify not configured");
  }

  const token = decrypt(config.coolifyApiToken);
  return { coolifyUrl: config.coolifyUrl.replace(/\/$/, ""), coolifyApiToken: token };
}

async function coolifyRequest<T>(
  method: string,
  path: string,
  body?: Record<string, unknown>
): Promise<T> {
  const { coolifyUrl, coolifyApiToken } = await loadConfig();

  const url = `${coolifyUrl}${path}`;
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${coolifyApiToken}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown network error";
    throw new Error(`Coolify unreachable: ${message}`);
  }

  if (!response.ok) {
    let detail = "";
    try {
      const json = await response.json() as { message?: string };
      detail = json.message ?? "";
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`Coolify API error ${response.status}${detail ? `: ${detail}` : ""}`);
  }

  // Some endpoints return 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

// ── Public functions ──────────────────────────────────────────────────────────

/** Fetch PlatformConfig from DB, returning the decrypted token. */
export async function getCoolifyConfig(): Promise<{
  coolifyUrl: string | null;
  tokenIsSet: boolean;
}> {
  const config = await prisma.platformConfig.findUnique({
    where: { id: "singleton" },
  });

  return {
    coolifyUrl: config?.coolifyUrl ?? null,
    tokenIsSet: Boolean(config?.coolifyApiToken),
  };
}

/** Upsert PlatformConfig — encrypts the token before storing. */
export async function setCoolifyConfig(url: string, token: string): Promise<void> {
  const encryptedToken = encrypt(token);
  await prisma.platformConfig.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      coolifyUrl: url,
      coolifyApiToken: encryptedToken,
    },
    update: {
      coolifyUrl: url,
      coolifyApiToken: encryptedToken,
    },
  });
}

/**
 * Deploy a project to Coolify.
 * - If project.coolifyAppId exists → trigger start on the existing app.
 * - Otherwise → create the app, set env vars, trigger start, save appId.
 */
export async function deployToCoolify(
  project: ProjectForCoolify,
  envVars: Record<string, string>
): Promise<void> {
  let appId = project.coolifyAppId;

  if (!appId) {
    // Create the application in Coolify
    const created = await coolifyRequest<CoolifyAppResponse>(
      "POST",
      "/api/v1/applications",
      {
        name: `${project.slug}-${project.team.slug}`,
        git_repository: project.repoUrl,
        dockerfile_path: project.dockerfilePath,
        build_pack: "dockerfile",
      }
    );

    appId = created.uuid;

    // Persist coolifyAppId back to the project
    await prisma.project.update({
      where: { id: project.id },
      data: { coolifyAppId: appId },
    });
  }

  // Set env vars on the application
  const envPayload = Object.entries(envVars).map(([key, value]) => ({ key, value }));
  if (envPayload.length > 0) {
    await coolifyRequest<unknown>(
      "POST",
      `/api/v1/applications/${appId}/envs`,
      { envs: envPayload }
    );
  }

  // Trigger deploy / start
  await coolifyRequest<unknown>("POST", `/api/v1/applications/${appId}/start`);
}

/** Stop a Coolify application. */
export async function stopCoolifyApp(coolifyAppId: string): Promise<void> {
  await coolifyRequest<unknown>("POST", `/api/v1/applications/${coolifyAppId}/stop`);
}

/** Get the current status of a Coolify application. */
export async function getCoolifyAppStatus(coolifyAppId: string): Promise<CoolifyAppResponse> {
  return coolifyRequest<CoolifyAppResponse>("GET", `/api/v1/applications/${coolifyAppId}`);
}
