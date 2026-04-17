import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import yaml from "js-yaml";
import prisma from "../lib/prisma";
import { getDecryptedGitHubToken } from "./github.service";

type PlatformRole = "owner" | "admin" | "user";

export interface RdeployYmlService {
  name: string;
  dockerfile: string;
  description: string;
}

export interface RdeployYmlResult {
  found: boolean;
  services: RdeployYmlService[];
}

interface CloneResult {
  project: {
    id: string;
    teamId: string;
    name: string;
    slug: string;
    repoUrl: string;
    dockerfilePath: string;
    status: string;
    healthStatus: string;
    port: number | null;
    containerId: string | null;
    restartCount: number;
    exitCode: number | null;
    deployLogs: string | null;
    createdAt: Date;
    updatedAt: Date;
    team: { id: string; name: string; slug: string };
  };
  envKeys: string[];
  rdeployYml: RdeployYmlResult;
}

function getWorkspaceBase(): string {
  return process.env.RDEPLOY_WORKSPACE_DIR ?? ".rdeploy/workspaces";
}

function resolveWorkspacePath(teamSlug: string, projectSlug: string): string {
  const base = path.resolve(getWorkspaceBase());
  const resolved = path.resolve(path.join(base, teamSlug, projectSlug, "repo"));

  // Path traversal guard
  if (!resolved.startsWith(base + path.sep) && resolved !== base) {
    throw new Error("Path traversal attempt detected");
  }

  return resolved;
}

export function parseRdeployYml(repoPath: string): RdeployYmlResult {
  const ymlPath = path.join(repoPath, "rdeploy.yml");

  if (!fs.existsSync(ymlPath)) {
    return { found: false, services: [] };
  }

  const raw = fs.readFileSync(ymlPath, "utf-8");
  const parsed = yaml.load(raw);

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("services" in parsed) ||
    typeof (parsed as Record<string, unknown>).services !== "object" ||
    (parsed as Record<string, unknown>).services === null
  ) {
    return { found: true, services: [] };
  }

  const servicesMap = (parsed as { services: Record<string, unknown> }).services;

  const services: RdeployYmlService[] = Object.entries(servicesMap)
    .filter(([, value]) => typeof value === "object" && value !== null)
    .map(([name, value]) => {
      const svc = value as Record<string, unknown>;
      return {
        name,
        dockerfile: typeof svc["dockerfile"] === "string" ? svc["dockerfile"] : "",
        description: typeof svc["description"] === "string" ? svc["description"] : "",
      };
    });

  return { found: true, services };
}

function parseEnvExample(filePath: string): string[] {
  const content = fs.readFileSync(filePath, "utf-8");
  const keys: string[] = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    // Skip blank lines and comments
    if (!line || line.startsWith("#")) continue;
    const eqIndex = line.indexOf("=");
    if (eqIndex === -1) continue;
    const key = line.slice(0, eqIndex).trim();
    if (key) keys.push(key);
  }

  return keys;
}

export async function cloneRepo(
  projectId: string,
  requesterId: string,
  requesterRole: PlatformRole
): Promise<CloneResult> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Permission check: owner/admin always allowed; regular users must be a team leader
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member || member.role !== "leader") {
      throw new Error("Forbidden");
    }
  }

  // Only allow cloning if status is pending or failed
  if (project.status !== "pending" && project.status !== "failed") {
    throw new Error("Project has already been connected");
  }

  // Set status to cloning
  await prisma.project.update({
    where: { id: projectId },
    data: { status: "cloning", deployLogs: null },
  });

  const workspacePath = resolveWorkspacePath(project.team.slug, project.slug);

  try {
    // Clean the directory if it already exists (re-clone scenario)
    if (fs.existsSync(workspacePath)) {
      fs.rmSync(workspacePath, { recursive: true, force: true });
    }
    fs.mkdirSync(workspacePath, { recursive: true });

    // Validate repo URL protocol and host before cloning
    const parsedUrl = new URL(project.repoUrl);
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'github.com') {
      throw new Error('Invalid repository URL');
    }

    // Build clone URL — inject GitHub token if user has one connected
    let cloneUrl = project.repoUrl;
    const githubToken = await getDecryptedGitHubToken(requesterId);

    if (githubToken && parsedUrl.hostname === "github.com") {
      // Extract org/repo path (strip leading slash)
      const repoPath = parsedUrl.pathname.replace(/^\//, "").replace(/\.git$/, "");
      cloneUrl = `https://${githubToken}@github.com/${repoPath}.git`;
    }

    // Clone the repo using spawnSync (NOT execSync — security rule)
    const cloneResult = spawnSync(
      "git",
      ["clone", cloneUrl, workspacePath],
      { encoding: "utf-8", timeout: 120_000 }
    );

    if (cloneResult.status !== 0) {
      const rawErr = cloneResult.stderr ?? "git clone failed";

      // Scrub any GitHub token from the error message before it escapes
      const errMsg = githubToken ? rawErr.replace(githubToken, "***") : rawErr;

      // Provide a helpful error when cloning fails and the user has no GitHub token
      if (!githubToken) {
        const lowerErr = errMsg.toLowerCase();
        if (
          lowerErr.includes("authentication failed") ||
          lowerErr.includes("could not read username") ||
          lowerErr.includes("repository not found")
        ) {
          throw new Error(
            "This repository may be private. Connect your GitHub account on the profile page to clone private repos."
          );
        }
      }

      throw new Error(errMsg.trim());
    }

    // Check Dockerfile exists at dockerfilePath (with traversal guard)
    const dockerfileFull = path.resolve(path.join(workspacePath, project.dockerfilePath));
    if (!dockerfileFull.startsWith(workspacePath + path.sep)) {
      throw new Error('Path traversal attempt in dockerfilePath');
    }
    if (!fs.existsSync(dockerfileFull)) {
      const msg = `Dockerfile missing at ${project.dockerfilePath}. Use the Master Prompt to standardize your project first.`;
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "failed", deployLogs: msg },
      });
      throw new Error(msg);
    }

    // Check .env.example exists at repo root
    const envExamplePath = path.join(workspacePath, ".env.example");
    if (!fs.existsSync(envExamplePath)) {
      const msg = ".env.example missing. Use the Master Prompt to standardize your project first.";
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "failed", deployLogs: msg },
      });
      throw new Error(msg);
    }

    // Parse .env.example keys
    const envKeys = parseEnvExample(envExamplePath);

    // Delete existing EnvVar records (re-clone scenario)
    await prisma.envVar.deleteMany({ where: { projectId } });

    // Create new EnvVar records for each key
    if (envKeys.length > 0) {
      await prisma.envVar.createMany({
        data: envKeys.map((key) => ({
          projectId,
          key,
          value: "",
          isSecret: false,
        })),
      });
    }

    // Set status to ready
    const updated = await prisma.project.update({
      where: { id: projectId },
      data: { status: "ready", deployLogs: null },
      include: { team: { select: { id: true, name: true, slug: true } } },
    });

    const rdeployYml = parseRdeployYml(workspacePath);

    return { project: updated, envKeys, rdeployYml };
  } catch (err) {
    // If already set to failed above, don't overwrite with a generic error
    const currentProject = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true },
    });

    if (currentProject?.status !== "failed") {
      const message = err instanceof Error ? err.message : "Unknown error";
      await prisma.project.update({
        where: { id: projectId },
        data: { status: "failed", deployLogs: message },
      });
    }

    throw err;
  }
}
