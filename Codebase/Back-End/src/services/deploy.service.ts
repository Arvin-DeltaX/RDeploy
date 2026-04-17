import fs from "fs";
import path from "path";
import http from "http";
import { decrypt } from "../utils/encryption";
import { getAvailablePort } from "../utils/ports";
import {
  buildImage,
  runContainer,
  stopContainer,
  removeContainer,
} from "./docker.service";
import prisma from "../lib/prisma";

type PlatformRole = "owner" | "admin" | "user";

export function getWorkspaceBase(): string {
  return process.env.RDEPLOY_WORKSPACE_DIR ?? ".rdeploy/workspaces";
}

export function getProjectWorkspace(teamSlug: string, projectSlug: string): string {
  return path.join(getWorkspaceBase(), teamSlug, projectSlug);
}

export async function checkLeaderPermission(
  requesterId: string,
  requesterRole: PlatformRole,
  teamId: string
): Promise<void> {
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } },
    });
    if (!member || member.role !== "leader") {
      throw new Error("Forbidden");
    }
  }
}

export async function checkMemberAccess(
  requesterId: string,
  requesterRole: PlatformRole,
  teamId: string
): Promise<void> {
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } },
    });
    if (!member) {
      throw new Error("Forbidden");
    }
  }
}

/**
 * Performs an HTTP health check against a locally running container.
 *
 * NOTE: `fetch` / EventSource cannot be used here because this is a plain HTTP
 * probe from Node.js to localhost — no custom headers or SSE involved.
 */
export function healthCheckHttp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: "localhost", port, path: "/health", timeout: 5000 },
      (res) => {
        resolve(res.statusCode === 200);
      }
    );
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}

export async function runDeployFlow(
  projectId: string,
  requesterId: string,
  requesterRole: PlatformRole,
  confirmed: boolean,
  allowedStatuses?: string[]
): Promise<{ warning?: boolean; localhostKeys?: string[]; project?: Record<string, unknown> }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  await checkLeaderPermission(requesterId, requesterRole, project.teamId);

  // Status guard
  if (project.status === "building" || project.status === "cloning") {
    throw Object.assign(new Error("Deploy already in progress"), { statusCode: 409 });
  }

  if (allowedStatuses && !allowedStatuses.includes(project.status)) {
    throw Object.assign(new Error("Deploy already in progress"), { statusCode: 409 });
  }

  // Load env vars with decrypted values
  const envVars = await prisma.envVar.findMany({
    where: { projectId },
    select: { id: true, key: true, value: true },
  });

  const decryptedVars: Array<{ key: string; value: string }> = envVars.map(
    (v: { id: string; key: string; value: string }) => ({
      key: v.key,
      value: v.value !== "" ? decrypt(v.value) : "",
    })
  );

  // Validation: missing values
  const missingKeys = decryptedVars.filter((v) => v.value === "").map((v) => v.key);
  if (missingKeys.length > 0) {
    throw Object.assign(new Error("Missing env var values"), {
      statusCode: 400,
      missingKeys,
    });
  }

  // Validation: localhost warning
  if (!confirmed) {
    const localhostKeywords = ["localhost", "127.0.0.1", "0.0.0.0"];
    const localhostKeys = decryptedVars
      .filter((v) => localhostKeywords.some((kw) => v.value.includes(kw)))
      .map((v) => v.key);

    if (localhostKeys.length > 0) {
      return { warning: true, localhostKeys };
    }
  }

  const teamSlug = project.team.slug;
  const projectSlug = project.slug;
  const tag = `rdeploy-${projectSlug}-${teamSlug}`;
  const containerName = `rdeploy-${projectSlug}-${teamSlug}`;
  const workspace = getProjectWorkspace(teamSlug, projectSlug);
  const repoDir = path.join(workspace, "repo");
  const envFilePath = path.join(workspace, ".env");

  // Mark building, clear logs
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "building", deployLogs: "" },
  });

  // Stop and remove old container
  if (project.containerId) {
    stopContainer(project.containerId);
    removeContainer(project.containerId);
  }

  // Assign port
  const port = await getAvailablePort();
  await prisma.project.update({ where: { id: projectId }, data: { port } });

  // Write .env file
  const envLines = [`PORT=${port}`];
  for (const v of decryptedVars) {
    envLines.push(`${v.key}=${v.value}`);
  }
  fs.mkdirSync(workspace, { recursive: true });
  fs.writeFileSync(envFilePath, envLines.join("\n"), { encoding: "utf8" });

  let deployLogs = "";

  try {
    // Validate dockerfilePath is contained within repoDir (prevent path traversal)
    const resolvedDockerfile = path.resolve(repoDir, project.dockerfilePath);
    const resolvedRepoDir = path.resolve(repoDir);
    if (
      !resolvedDockerfile.startsWith(resolvedRepoDir + path.sep) &&
      resolvedDockerfile !== resolvedRepoDir
    ) {
      throw Object.assign(new Error("Invalid dockerfilePath: path traversal detected"), {
        statusCode: 400,
      });
    }

    // Build image
    const buildOutput = await buildImage(
      tag,
      resolvedDockerfile,
      repoDir,
      (line) => {
        deployLogs += line + "\n";
      }
    );
    deployLogs += buildOutput;

    // Run container
    const domain = process.env.RDEPLOY_DOMAIN ?? "deltaxs.co";
    const network = process.env.DOCKER_NETWORK ?? "rdeploy-net";

    const containerId = await runContainer(
      tag,
      containerName,
      port,
      network,
      projectSlug,
      teamSlug,
      domain,
      envFilePath,
      (line) => {
        deployLogs += line + "\n";
      }
    );

    // Delete .env immediately
    try {
      fs.unlinkSync(envFilePath);
    } catch {
      /* ignore */
    }

    // Cap logs at 50KB
    if (deployLogs.length > 50_000) {
      deployLogs = deployLogs.slice(-50_000);
    }

    // Update project to running
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "running",
        containerId,
        port,
        deployLogs,
        healthStatus: "unknown",
      },
      include: { team: { select: { id: true, name: true, slug: true } } },
    });

    // Background health check after 15s
    setTimeout(async () => {
      try {
        const healthy = await healthCheckHttp(port);
        await prisma.project.update({
          where: { id: projectId },
          data: { healthStatus: healthy ? "healthy" : "unhealthy" },
        });
      } catch (err) {
        console.error(`Health check error for project ${projectId}:`, err);
      }
    }, 15_000);

    return { project: updatedProject as unknown as Record<string, unknown> };
  } catch (err) {
    // Delete .env if still present
    try {
      fs.unlinkSync(envFilePath);
    } catch {
      /* ignore */
    }

    if (deployLogs.length > 50_000) {
      deployLogs = deployLogs.slice(-50_000);
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { status: "failed", deployLogs },
    });

    throw err;
  }
}
