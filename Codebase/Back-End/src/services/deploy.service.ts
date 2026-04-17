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
  tagImage,
  removeImage,
} from "./docker.service";
import { sendDeploySuccess, sendDeployFailure } from "./email.service";
import { deployToCoolify } from "./coolify.service";
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

/** Collect unique email addresses for users who should receive deploy notifications. */
async function getNotificationRecipients(projectId: string, teamId: string): Promise<string[]> {
  // ProjectAssignment users + team leader/elder members who have emailNotifications: true
  const [assignedUsers, teamMembers] = await Promise.all([
    prisma.projectAssignment.findMany({
      where: { projectId },
      include: { user: { select: { email: true, emailNotifications: true } } },
    }),
    prisma.teamMember.findMany({
      where: { teamId, role: { in: ["leader", "elder"] } },
      include: { user: { select: { email: true, emailNotifications: true } } },
    }),
  ]);

  const emails = new Set<string>();

  for (const a of assignedUsers) {
    if (a.user.emailNotifications) {
      emails.add(a.user.email);
    }
  }
  for (const m of teamMembers) {
    if (m.user.emailNotifications) {
      emails.add(m.user.email);
    }
  }

  return Array.from(emails);
}

export async function runDeployFlow(
  projectId: string,
  requesterId: string,
  requesterRole: PlatformRole,
  confirmed: boolean,
  allowedStatuses?: string[],
  deployedByOverride?: string,
  skipPermissionCheck?: boolean
): Promise<{ warning?: boolean; localhostKeys?: string[]; project?: Record<string, unknown> }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });

  // replicaCount defaults to 1 if not set (prisma default, but be safe)

  if (!project) {
    throw new Error("Project not found");
  }

  if (!skipPermissionCheck) {
    await checkLeaderPermission(requesterId, requesterRole, project.teamId);
  }

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

  // ── Coolify deploy path ───────────────────────────────────────────────────
  if (project.deployTarget === "coolify") {
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "building", deployLogs: "" },
    });

    const envMap: Record<string, string> = {};
    for (const v of decryptedVars) {
      envMap[v.key] = v.value;
    }

    try {
      await deployToCoolify(
        {
          id: project.id,
          name: project.name,
          slug: project.slug,
          repoUrl: project.repoUrl,
          dockerfilePath: project.dockerfilePath,
          coolifyAppId: project.coolifyAppId ?? null,
          team: { slug: project.team.slug },
        },
        envMap
      );

      const updatedProject = await prisma.project.update({
        where: { id: projectId },
        data: { status: "running", deployLogs: "Deployed via Coolify." },
        include: {
          team: { select: { id: true, name: true, slug: true } },
          replicas: { orderBy: { replicaIndex: "asc" } },
        },
      });

      // Fire-and-forget success emails
      const liveUrl = `https://${project.slug}-${project.team.slug}.${process.env.RDEPLOY_DOMAIN ?? "deltaxs.co"}`;
      getNotificationRecipients(projectId, project.teamId).then((recipients) => {
        for (const email of recipients) {
          sendDeploySuccess(email, project.name, project.team.name, liveUrl).catch(() => {});
        }
      }).catch(() => {});

      return { project: updatedProject as unknown as Record<string, unknown> };
    } catch (err) {
      const logs = err instanceof Error ? err.message : "Coolify deploy failed";
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "failed", deployLogs: logs },
      });

      getNotificationRecipients(projectId, project.teamId).then((recipients) => {
        for (const email of recipients) {
          sendDeployFailure(email, project.name, project.team.name, logs).catch(() => {});
        }
      }).catch(() => {});

      throw err;
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  const teamSlug = project.team.slug;
  const projectSlug = project.slug;
  const tag = `rdeploy-${projectSlug}-${teamSlug}`;
  const workspace = getProjectWorkspace(teamSlug, projectSlug);
  const repoDir = path.join(workspace, "repo");
  const envFilePath = path.join(workspace, ".env");

  // How many replicas to spin up
  const replicaCount = project.replicaCount ?? 1;

  // Mark building, clear logs
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "building", deployLogs: "" },
  });

  // Stop and remove all existing replica containers
  const existingReplicas = await prisma.projectReplica.findMany({
    where: { projectId },
    select: { containerId: true },
  });
  for (const replica of existingReplicas) {
    if (replica.containerId) {
      stopContainer(replica.containerId);
      removeContainer(replica.containerId);
    }
  }

  // Also stop legacy containerId for backward compat
  if (project.containerId) {
    stopContainer(project.containerId);
    removeContainer(project.containerId);
  }

  // Write .env file (port will be set per-replica but we need base env vars)
  fs.mkdirSync(workspace, { recursive: true });

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

    // Build image (once for all replicas)
    const buildOutput = await buildImage(
      tag,
      resolvedDockerfile,
      repoDir,
      (line) => {
        deployLogs += line + "\n";
      }
    );
    deployLogs += buildOutput;

    const domain = process.env.RDEPLOY_DOMAIN ?? "deltaxs.co";
    const network = process.env.DOCKER_NETWORK ?? "rdeploy-net";
    // Traefik router name is always the same for all replicas — allows Traefik LB
    const traefikRouterName = `rdeploy-${projectSlug}-${teamSlug}`;

    let firstContainerId: string | null = null;
    let firstPort: number | null = null;

    // Spin up replicas
    for (let i = 0; i < replicaCount; i++) {
      const replicaPort = await getAvailablePort();
      const replicaContainerName = `rdeploy-${projectSlug}-${teamSlug}-${i}`;

      // Write per-replica .env with the correct PORT
      const envLines = [`PORT=${replicaPort}`];
      for (const v of decryptedVars) {
        envLines.push(`${v.key}=${v.value}`);
      }
      fs.writeFileSync(envFilePath, envLines.join("\n"), { encoding: "utf8" });

      const containerId = await runContainer(
        tag,
        replicaContainerName,
        replicaPort,
        network,
        projectSlug,
        teamSlug,
        domain,
        envFilePath,
        (line) => {
          deployLogs += line + "\n";
        },
        project.cpuLimit,
        project.memoryLimit,
        traefikRouterName,
        project.customDomain
      );

      // Delete .env immediately after each replica starts
      try {
        fs.unlinkSync(envFilePath);
      } catch {
        /* ignore */
      }

      // Upsert ProjectReplica record
      await prisma.projectReplica.upsert({
        where: { projectId_replicaIndex: { projectId, replicaIndex: i } },
        create: {
          projectId,
          replicaIndex: i,
          containerId,
          port: replicaPort,
          status: "running",
        },
        update: {
          containerId,
          port: replicaPort,
          status: "running",
        },
      });

      if (i === 0) {
        firstContainerId = containerId;
        firstPort = replicaPort;
      }
    }

    // Delete any stale replica records beyond current replicaCount
    const staleReplicas = await prisma.projectReplica.findMany({
      where: { projectId, replicaIndex: { gte: replicaCount } },
      select: { containerId: true, id: true },
    });
    for (const stale of staleReplicas) {
      if (stale.containerId) {
        stopContainer(stale.containerId);
        removeContainer(stale.containerId);
      }
      await prisma.projectReplica.delete({ where: { id: stale.id } });
    }

    // Cap logs at 50KB
    if (deployLogs.length > 50_000) {
      deployLogs = deployLogs.slice(-50_000);
    }

    // ── Deploy history ────────────────────────────────────────────────────────

    const historyCount = await prisma.deploymentHistory.count({ where: { projectId } });
    const deployNumber = historyCount + 1;

    const versionedTag = `${tag}:${deployNumber}`;
    const latestTag = `${tag}:latest`;
    tagImage(tag, versionedTag);
    tagImage(tag, latestTag);

    await prisma.deploymentHistory.updateMany({
      where: { projectId },
      data: { isActive: false },
    });

    await prisma.deploymentHistory.create({
      data: {
        projectId,
        imageTag: versionedTag,
        deployLogs,
        deployedBy: deployedByOverride ?? requesterId,
        isActive: true,
        deployNumber,
      },
    });

    const MAX_HISTORY = 5;
    const totalRecords = await prisma.deploymentHistory.count({ where: { projectId } });
    if (totalRecords > MAX_HISTORY) {
      const toDelete = await prisma.deploymentHistory.findMany({
        where: { projectId },
        orderBy: { deployNumber: "asc" },
        take: totalRecords - MAX_HISTORY,
        select: { id: true, imageTag: true },
      });
      for (const record of toDelete) {
        removeImage(record.imageTag);
        await prisma.deploymentHistory.delete({ where: { id: record.id } });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────

    // Update project — store first replica's containerId/port for backward compat
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        status: "running",
        containerId: firstContainerId,
        port: firstPort,
        deployLogs,
        healthStatus: "unknown",
      },
      include: {
        team: { select: { id: true, name: true, slug: true } },
        replicas: { orderBy: { replicaIndex: "asc" } },
      },
    });

    // Fire-and-forget deploy success emails
    const liveUrl = `https://${projectSlug}-${teamSlug}.${process.env.RDEPLOY_DOMAIN ?? "deltaxs.co"}`;
    getNotificationRecipients(projectId, project.teamId).then((recipients) => {
      for (const email of recipients) {
        sendDeploySuccess(email, project.name, project.team.name, liveUrl).catch(() => {
          /* silently ignore */
        });
      }
    }).catch(() => { /* silently ignore */ });

    // Background health check after 15s (check first replica)
    if (firstPort !== null) {
      const capturedPort = firstPort;
      setTimeout(async () => {
        try {
          const healthy = await healthCheckHttp(capturedPort);
          await prisma.project.update({
            where: { id: projectId },
            data: { healthStatus: healthy ? "healthy" : "unhealthy" },
          });
        } catch (err) {
          console.error(`Health check error for project ${projectId}:`, err);
        }
      }, 15_000);
    }

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

    // Fire-and-forget deploy failure emails
    getNotificationRecipients(projectId, project.teamId).then((recipients) => {
      for (const email of recipients) {
        sendDeployFailure(email, project.name, project.team.name, deployLogs).catch(() => {
          /* silently ignore */
        });
      }
    }).catch(() => { /* silently ignore */ });

    throw err;
  }
}
