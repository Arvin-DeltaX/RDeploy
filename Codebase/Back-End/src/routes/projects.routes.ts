import fs from "fs";
import path from "path";
import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { requireTeamRole } from "../middleware/requireTeamRole";
import { requirePlatformRole } from "../middleware/requirePlatformRole";
import {
  createProject,
  listTeamProjects,
  listAllProjects,
  getProject,
  deleteProject,
  assignMembers,
  removeProjectMember,
  listProjectMembers,
} from "../services/projects.service";
import { cloneRepo, parseRdeployYml } from "../services/git.service";
import { getEnvVars, updateEnvVars } from "../services/env.service";
import {
  stopContainer,
  removeContainer,
  runContainer,
  inspectContainer,
  streamContainerLogs,
} from "../services/docker.service";
import { getAvailablePort } from "../utils/ports";
import {
  runDeployFlow,
  checkLeaderPermission,
  checkMemberAccess,
} from "../services/deploy.service";
import { encrypt, decrypt } from "../utils/encryption";
import { getCoolifyConfig } from "../services/coolify.service";
import prisma from "../lib/prisma";

const router = Router();

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createProjectSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  repoUrl: z.string().url("repoUrl must be a valid URL").refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.hostname === 'github.com' && u.protocol === 'https:';
      } catch { return false; }
    },
    { message: 'Repository URL must be a valid https://github.com URL' }
  ),
  dockerfilePath: z.string().min(1).refine(
    (v) => !v.split('/').includes('..'),
    { message: 'dockerfilePath must not contain path traversal' }
  ).default('Dockerfile').optional(),
});

const assignMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1, "At least one userId is required"),
});

const deploySchema = z.object({
  confirmed: z.boolean().optional(),
});

const resourceLimitsSchema = z.object({
  cpuLimit: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => v == null || /^\d+(\.\d+)?$/.test(v) && parseFloat(v) > 0,
      { message: "cpuLimit must be a positive number string e.g. \"0.5\", \"1\", \"2.0\"" }
    ),
  memoryLimit: z
    .string()
    .nullable()
    .optional()
    .refine(
      (v) => v == null || /^\d+[mg]$/i.test(v),
      { message: "memoryLimit must match pattern e.g. \"256m\", \"512m\", \"1g\", \"2g\"" }
    ),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

type PlatformRole = "owner" | "admin" | "user";

// ─── POST /api/teams/:teamId/projects ─────────────────────────────────────────

router.post(
  "/teams/:teamId/projects",
  requireAuth,
  requireTeamRole("leader"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { name, repoUrl, dockerfilePath = "Dockerfile" } = parsed.data;
    const teamId = req.params.teamId as string;

    try {
      const project = await createProject(teamId, name, repoUrl, dockerfilePath);
      res.status(201).json({ data: project });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = message === "Team not found" ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
);

// ─── GET /api/teams/:teamId/projects ──────────────────────────────────────────

router.get(
  "/teams/:teamId/projects",
  requireAuth,
  requireTeamRole("member"),
  async (req: Request, res: Response): Promise<void> => {
    const teamId = req.params.teamId as string;
    const user = req.user;

    try {
      const projects = await listTeamProjects(teamId, user.id, user.platformRole as "owner" | "admin" | "user");
      res.json({ data: projects });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = message === "Team not found" ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
);

// ─── GET /api/projects ────────────────────────────────────────────────────────

router.get(
  "/projects",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const user = req.user;

    try {
      const projects = await listAllProjects(user.id, user.platformRole as "owner" | "admin" | "user");
      res.json({ data: projects });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  }
);

// ─── GET /api/projects/:id ────────────────────────────────────────────────────

router.get(
  "/projects/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await getProject(id, user.id, user.platformRole as "owner" | "admin" | "user");
      res.json({ data: project });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = message === "Project not found" ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
);

// ─── DELETE /api/projects/:id ─────────────────────────────────────────────────

router.delete(
  "/projects/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      await deleteProject(id, user.id, user.platformRole as "owner" | "admin" | "user");
      res.json({ data: { message: "Project deleted" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/members ──────────────────────────────────────────

router.post(
  "/projects/:id/members",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = assignMembersSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const assignments = await assignMembers(
        id,
        parsed.data.userIds,
        user.id,
        user.platformRole as "owner" | "admin" | "user"
      );
      res.status(201).json({ data: assignments });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else if (message.includes("not found") || message.includes("not a member")) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── DELETE /api/projects/:id/members/:userId ─────────────────────────────────

router.delete(
  "/projects/:id/members/:userId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const userId = req.params.userId as string;
    const user = req.user;

    try {
      await removeProjectMember(
        id,
        userId,
        user.id,
        user.platformRole as "owner" | "admin" | "user"
      );
      res.json({ data: { message: "Member removed from project" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else if (message === "User is not assigned to this project") {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── GET /api/projects/:id/members ───────────────────────────────────────────

router.get(
  "/projects/:id/members",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const members = await listProjectMembers(
        id,
        user.id,
        user.platformRole as "owner" | "admin" | "user"
      );
      res.json({ data: members });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = message === "Project not found" ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
);

// ─── POST /api/projects/:id/clone ────────────────────────────────────────────

router.post(
  "/projects/:id/clone",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const result = await cloneRepo(
        id,
        user.id,
        user.platformRole as "owner" | "admin" | "user"
      );
      res.json({ data: { project: result.project, envKeys: result.envKeys, rdeployYml: result.rdeployYml } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else if (message === "Project has already been connected") {
        res.status(400).json({ error: message });
      } else if (
        message.includes("Dockerfile missing") ||
        message.includes(".env.example missing")
      ) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── GET /api/projects/:id/env ────────────────────────────────────────────────

router.get(
  "/projects/:id/env",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const envVars = await getEnvVars(
        id,
        user.id,
        user.platformRole as "owner" | "admin" | "user"
      );
      res.json({ data: { envVars } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── PUT /api/projects/:id/env ────────────────────────────────────────────────

const updateEnvVarsSchema = z.object({
  vars: z
    .array(
      z.object({
        id: z.string().uuid("var id must be a valid UUID"),
        value: z.string().refine(
          (v) => !v.includes("\n") && !v.includes("\r"),
          { message: "Env var value must not contain newline characters" }
        ),
        isSecret: z.boolean(),
      })
    )
    .min(1, "vars must contain at least one item"),
});

router.put(
  "/projects/:id/env",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = updateEnvVarsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const updated = await updateEnvVars(
        id,
        parsed.data.vars,
        user.id,
        user.platformRole as "owner" | "admin" | "user"
      );
      res.json({ data: { updated } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else if (message.includes("not found on this project")) {
        res.status(400).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/deploy ───────────────────────────────────────────

router.post(
  "/projects/:id/deploy",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = deploySchema.safeParse(req.body);
    const confirmed = parsed.success ? (parsed.data.confirmed ?? false) : false;

    try {
      const result = await runDeployFlow(
        id,
        user.id,
        user.platformRole as PlatformRole,
        confirmed
      );

      if (result.warning) {
        res.status(200).json({ data: { warning: true, localhostKeys: result.localhostKeys } });
        return;
      }

      res.json({ data: { project: result.project } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const statusCode = (err as { statusCode?: number }).statusCode;
      const missingKeys = (err as { missingKeys?: string[] }).missingKeys;

      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else if (statusCode === 409) {
        res.status(409).json({ error: message });
      } else if (message === "Missing env var values" && missingKeys) {
        res.status(400).json({ error: message, missingKeys });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/redeploy ─────────────────────────────────────────

router.post(
  "/projects/:id/redeploy",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = deploySchema.safeParse(req.body);
    const confirmed = parsed.success ? (parsed.data.confirmed ?? false) : false;

    try {
      const result = await runDeployFlow(
        id,
        user.id,
        user.platformRole as PlatformRole,
        confirmed,
        ["running", "failed", "stopped"]
      );

      if (result.warning) {
        res.status(200).json({ data: { warning: true, localhostKeys: result.localhostKeys } });
        return;
      }

      res.json({ data: { project: result.project } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const statusCode = (err as { statusCode?: number }).statusCode;
      const missingKeys = (err as { missingKeys?: string[] }).missingKeys;

      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else if (statusCode === 409) {
        res.status(409).json({ error: message });
      } else if (message === "Missing env var values" && missingKeys) {
        res.status(400).json({ error: message, missingKeys });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/stop ─────────────────────────────────────────────

router.post(
  "/projects/:id/stop",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true, containerId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkLeaderPermission(user.id, user.platformRole as PlatformRole, project.teamId);

      // Stop all replica containers
      const replicas = await prisma.projectReplica.findMany({
        where: { projectId: id },
        select: { id: true, containerId: true },
      });

      for (const replica of replicas) {
        if (replica.containerId) {
          stopContainer(replica.containerId);
          removeContainer(replica.containerId);
        }
        await prisma.projectReplica.update({
          where: { id: replica.id },
          data: { status: "stopped", containerId: null },
        });
      }

      // Also stop the legacy containerId (backward compat / single-replica case)
      if (project.containerId) {
        stopContainer(project.containerId);
        removeContainer(project.containerId);
      }

      if (!project.containerId && replicas.length === 0) {
        res.status(400).json({ error: "No container running" });
        return;
      }

      await prisma.project.update({
        where: { id },
        data: { status: "stopped", healthStatus: "unknown", containerId: null },
      });

      res.json({ data: { message: "Container stopped" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── GET /api/projects/:id/logs ──────────────────────────────────────────────

router.get(
  "/projects/:id/logs",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true, deployLogs: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkMemberAccess(user.id, user.platformRole as PlatformRole, project.teamId);

      res.json({ data: { logs: project.deployLogs ?? "" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── GET /api/projects/:id/container-status ──────────────────────────────────

router.get(
  "/projects/:id/container-status",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true, containerId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkMemberAccess(user.id, user.platformRole as PlatformRole, project.teamId);

      if (!project.containerId) {
        res.status(404).json({ error: "No container" });
        return;
      }

      const state = inspectContainer(project.containerId);

      if (!state) {
        res.status(404).json({ error: "Container not found" });
        return;
      }

      res.json({
        data: {
          running: state.running,
          exitCode: state.exitCode,
          restartCount: state.restartCount,
          startedAt: state.startedAt,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/env/upload ───────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 }, // 100KB
});

router.post(
  "/projects/:id/env/upload",
  requireAuth,
  upload.single("file"),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Permission: leader or elder
      if ((user.platformRole as PlatformRole) === "user") {
        const member = await prisma.teamMember.findUnique({
          where: { userId_teamId: { userId: user.id, teamId: project.teamId } },
        });
        if (!member || (member.role !== "leader" && member.role !== "elder")) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
      }

      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const content = req.file.buffer.toString("utf8");
      const lines = content.split("\n");

      // Parse KEY=VALUE pairs
      const parsedPairs: Record<string, string> = {};
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIndex = trimmed.indexOf("=");
        if (eqIndex === -1) continue;
        const key = trimmed.substring(0, eqIndex).trim();
        const rawValue = trimmed.substring(eqIndex + 1).trim();
        // Reject values containing newlines to prevent .env injection
        if (rawValue.includes("\n") || rawValue.includes("\r")) continue;
        if (key) {
          parsedPairs[key] = rawValue;
        }
      }

      // Find matching EnvVars and update
      let updated = 0;
      for (const [key, value] of Object.entries(parsedPairs)) {
        const existing = await prisma.envVar.findUnique({
          where: { projectId_key: { projectId: id, key } },
        });

        if (existing) {
          const encryptedValue = value !== "" ? encrypt(value) : "";
          await prisma.envVar.update({
            where: { id: existing.id },
            data: { value: encryptedValue },
          });
          updated++;
        }
      }

      res.json({ data: { updated } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  }
);

// ─── GET /api/projects/:id/logs/stream (SSE) ─────────────────────────────────

router.get(
  "/projects/:id/logs/stream",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;
    const type = (req.query["type"] as string) ?? "deploy";

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true, status: true, deployLogs: true, containerId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkMemberAccess(user.id, user.platformRole as PlatformRole, project.teamId);

      // SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      // Keepalive every 30s
      const keepaliveInterval = setInterval(() => {
        res.write(": keepalive\n\n");
      }, 30_000);

      const cleanup = (): void => {
        clearInterval(keepaliveInterval);
      };

      req.on("close", cleanup);

      if (type === "app") {
        // Stream live docker logs
        if (!project.containerId || project.status !== "running") {
          res.write("data: Container is not running\n\n");
          cleanup();
          res.end();
          return;
        }

        const killProc = streamContainerLogs(
          project.containerId,
          (line) => {
            res.write(`data: ${line}\n\n`);
          },
          () => {
            cleanup();
            res.end();
          }
        );

        req.on("close", () => {
          killProc();
          cleanup();
        });
      } else {
        // Deploy logs streaming
        const isActive = project.status === "building" || project.status === "cloning";

        if (!isActive) {
          // Send current logs and close
          const logs = project.deployLogs ?? "";
          if (logs) {
            res.write(`data: ${logs.replace(/\n/g, "\ndata: ")}\n\n`);
          }
          res.write("data: [DONE]\n\n");
          cleanup();
          res.end();
          return;
        }

        // Poll for changes every 500ms
        let lastLength = 0;
        const pollInterval = setInterval(async () => {
          try {
            const current = await prisma.project.findUnique({
              where: { id },
              select: { status: true, deployLogs: true },
            });

            if (!current) {
              clearInterval(pollInterval);
              cleanup();
              res.end();
              return;
            }

            const logs = current.deployLogs ?? "";
            if (logs.length > lastLength) {
              const newChunk = logs.substring(lastLength);
              lastLength = logs.length;
              const lines = newChunk.split("\n");
              for (const line of lines) {
                res.write(`data: ${line}\n\n`);
              }
            }

            const stillActive = current.status === "building" || current.status === "cloning";
            if (!stillActive) {
              clearInterval(pollInterval);
              res.write("data: [DONE]\n\n");
              cleanup();
              res.end();
            }
          } catch (err) {
            console.error("SSE poll error:", err);
            clearInterval(pollInterval);
            cleanup();
            res.end();
          }
        }, 500);

        req.on("close", () => {
          clearInterval(pollInterval);
          cleanup();
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (!res.headersSent) {
        if (message === "Forbidden") {
          res.status(403).json({ error: message });
        } else {
          res.status(500).json({ error: message });
        }
      } else {
        res.end();
      }
    }
  }
);

// ─── GET /api/projects/:id/deploys ───────────────────────────────────────────

router.get(
  "/projects/:id/deploys",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkMemberAccess(user.id, user.platformRole as PlatformRole, project.teamId);

      const history = await prisma.deploymentHistory.findMany({
        where: { projectId: id },
        orderBy: { deployNumber: "desc" },
        select: {
          id: true,
          deployNumber: true,
          deployedAt: true,
          isActive: true,
          imageTag: true,
          user: { select: { id: true, name: true } },
        },
      });

      const data = history.map((h) => ({
        id: h.id,
        deployNumber: h.deployNumber,
        deployedAt: h.deployedAt,
        isActive: h.isActive,
        imageTag: h.imageTag,
        deployedBy: h.user,
      }));

      res.json({ data });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/rollback/:deployId ────────────────────────────────

router.post(
  "/projects/:id/rollback/:deployId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const deployId = req.params.deployId as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          teamId: true,
          slug: true,
          status: true,
          containerId: true,
          cpuLimit: true,
          memoryLimit: true,
          customDomain: true,
          team: { select: { id: true, slug: true } },
        },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Leader-level permission required
      await checkLeaderPermission(user.id, user.platformRole as PlatformRole, project.teamId);

      // Status guard — cannot rollback while building or cloning
      if (project.status === "building" || project.status === "cloning") {
        res.status(409).json({ error: "Deploy already in progress" });
        return;
      }

      // Verify deploy record belongs to this project
      const deployRecord = await prisma.deploymentHistory.findUnique({
        where: { id: deployId },
        select: { id: true, projectId: true, imageTag: true, deployNumber: true },
      });

      if (!deployRecord || deployRecord.projectId !== id) {
        res.status(404).json({ error: "Deploy record not found" });
        return;
      }

      // Stop and remove current container if running
      if (project.containerId) {
        stopContainer(project.containerId);
        removeContainer(project.containerId);
      }

      // Assign a new port
      const port = await getAvailablePort();

      const projectSlug = project.slug;
      const teamSlug = project.team.slug;
      const containerName = `rdeploy-${projectSlug}-${teamSlug}`;
      const domain = process.env.RDEPLOY_DOMAIN ?? "deltaxs.co";
      const network = process.env.DOCKER_NETWORK ?? "rdeploy-net";

      // Write full .env (PORT + all decrypted env vars) so the container starts correctly
      const workspaceBase = process.env.RDEPLOY_WORKSPACE_DIR ?? ".rdeploy/workspaces";
      const workspace = path.join(workspaceBase, teamSlug, projectSlug);
      const envFilePath = path.join(workspace, ".env");

      const rawEnvVars = await prisma.envVar.findMany({
        where: { projectId: id },
        select: { key: true, value: true },
      });
      const envLines = [`PORT=${port}`];
      for (const v of rawEnvVars) {
        const decryptedValue = v.value !== "" ? decrypt(v.value) : "";
        envLines.push(`${v.key}=${decryptedValue}`);
      }

      fs.mkdirSync(workspace, { recursive: true });
      fs.writeFileSync(envFilePath, envLines.join("\n"), { encoding: "utf8" });

      let containerId: string;
      try {
        containerId = await runContainer(
          deployRecord.imageTag,
          containerName,
          port,
          network,
          projectSlug,
          teamSlug,
          domain,
          envFilePath,
          undefined,
          project.cpuLimit,
          project.memoryLimit,
          undefined,
          project.customDomain
        );
      } finally {
        // Always clean up .env
        try {
          fs.unlinkSync(envFilePath);
        } catch {
          /* ignore */
        }
      }

      // Update project state
      await prisma.project.update({
        where: { id },
        data: {
          status: "running",
          containerId,
          port,
          healthStatus: "unknown",
        },
      });

      // Set this record active, deactivate all others
      await prisma.deploymentHistory.updateMany({
        where: { projectId: id },
        data: { isActive: false },
      });
      await prisma.deploymentHistory.update({
        where: { id: deployId },
        data: { isActive: true },
      });

      res.json({
        data: {
          message: "Rollback successful",
          deployNumber: deployRecord.deployNumber,
          imageTag: deployRecord.imageTag,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else if (message === "Deploy record not found") {
        res.status(404).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/webhook/setup ────────────────────────────────────

router.post(
  "/projects/:id/webhook/setup",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkLeaderPermission(user.id, user.platformRole as PlatformRole, project.teamId);

      const { randomBytes } = await import("crypto");
      const webhookSecret = randomBytes(32).toString("hex");

      await prisma.project.update({
        where: { id },
        data: { webhookSecret },
      });

      const platformUrl = process.env.RDEPLOY_PLATFORM_URL ?? "https://rdeploy.deltaxs.co";
      const webhookUrl = `${platformUrl}/api/webhooks/github/${id}`;

      res.json({ data: { webhookSecret, webhookUrl } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── GET /api/projects/:id/webhook ───────────────────────────────────────────

router.get(
  "/projects/:id/webhook",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true, webhookSecret: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkMemberAccess(user.id, user.platformRole as PlatformRole, project.teamId);

      const platformUrl = process.env.RDEPLOY_PLATFORM_URL ?? "https://rdeploy.deltaxs.co";
      const webhookUrl = `${platformUrl}/api/webhooks/github/${id}`;

      res.json({ data: { webhookUrl, hasSecret: project.webhookSecret !== null } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── PUT /api/projects/:id/resource-limits ───────────────────────────────────

router.put(
  "/projects/:id/resource-limits",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = resourceLimitsSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      // Permission: leader or elder (same as env vars)
      if ((user.platformRole as PlatformRole) === "user") {
        const member = await prisma.teamMember.findUnique({
          where: { userId_teamId: { userId: user.id, teamId: project.teamId } },
        });
        if (!member || (member.role !== "leader" && member.role !== "elder")) {
          res.status(403).json({ error: "Forbidden" });
          return;
        }
      }

      const { cpuLimit, memoryLimit } = parsed.data;

      const updated = await prisma.project.update({
        where: { id },
        data: {
          ...(cpuLimit !== undefined ? { cpuLimit: cpuLimit ?? null } : {}),
          ...(memoryLimit !== undefined ? { memoryLimit: memoryLimit ?? null } : {}),
        },
        select: { cpuLimit: true, memoryLimit: true },
      });

      res.json({ data: { cpuLimit: updated.cpuLimit, memoryLimit: updated.memoryLimit } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  }
);

// ─── PUT /api/projects/:id/replicas ──────────────────────────────────────────

const replicaCountSchema = z.object({
  replicaCount: z
    .number({ invalid_type_error: "replicaCount must be a number" })
    .int("replicaCount must be an integer")
    .min(1, "replicaCount must be at least 1")
    .max(5, "replicaCount must be at most 5"),
});

router.put(
  "/projects/:id/replicas",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = replicaCountSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkLeaderPermission(user.id, user.platformRole as PlatformRole, project.teamId);

      const updated = await prisma.project.update({
        where: { id },
        data: { replicaCount: parsed.data.replicaCount },
        select: { replicaCount: true },
      });

      res.json({ data: { replicaCount: updated.replicaCount } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── PUT /api/projects/:id/custom-domain ─────────────────────────────────────

const customDomainSchema = z.object({
  customDomain: z
    .string()
    .nullable()
    .refine(
      (v) => {
        if (v === null) return true;
        // Must be a valid hostname: no protocol, no path, no spaces, no trailing slash
        return /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(v);
      },
      { message: "customDomain must be a valid hostname (e.g. api.mycompany.com) with no protocol or trailing slash" }
    ),
});

router.put(
  "/projects/:id/custom-domain",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = customDomainSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { customDomain } = parsed.data;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          teamId: true,
          slug: true,
          status: true,
          containerId: true,
          port: true,
          cpuLimit: true,
          memoryLimit: true,
          customDomain: true,
          team: { select: { id: true, slug: true } },
        },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkLeaderPermission(user.id, user.platformRole as PlatformRole, project.teamId);

      // Save to DB
      await prisma.project.update({
        where: { id },
        data: { customDomain: customDomain ?? null },
      });

      // If currently running, restart the container with updated Traefik labels
      if (project.status === "running" && project.containerId && project.port !== null) {
        const teamSlug = project.team.slug;
        const projectSlug = project.slug;
        const domain = process.env.RDEPLOY_DOMAIN ?? "deltaxs.co";
        const network = process.env.DOCKER_NETWORK ?? "rdeploy-net";
        const tag = `rdeploy-${projectSlug}-${teamSlug}`;
        const containerName = `rdeploy-${projectSlug}-${teamSlug}-0`;
        const traefikRouterName = `rdeploy-${projectSlug}-${teamSlug}`;

        const workspaceBase = process.env.RDEPLOY_WORKSPACE_DIR ?? ".rdeploy/workspaces";
        const workspace = path.join(workspaceBase, teamSlug, projectSlug);
        const envFilePath = path.join(workspace, ".env");

        stopContainer(project.containerId);
        removeContainer(project.containerId);

        const rawEnvVarsForDomain = await prisma.envVar.findMany({
          where: { projectId: id },
          select: { key: true, value: true },
        });
        const domainEnvLines = [`PORT=${project.port}`];
        for (const v of rawEnvVarsForDomain) {
          const decryptedValue = v.value !== "" ? decrypt(v.value) : "";
          domainEnvLines.push(`${v.key}=${decryptedValue}`);
        }

        fs.mkdirSync(workspace, { recursive: true });
        fs.writeFileSync(envFilePath, domainEnvLines.join("\n"), { encoding: "utf8" });

        let newContainerId: string;
        try {
          newContainerId = await runContainer(
            tag,
            containerName,
            project.port,
            network,
            projectSlug,
            teamSlug,
            domain,
            envFilePath,
            undefined,
            project.cpuLimit,
            project.memoryLimit,
            traefikRouterName,
            customDomain ?? null
          );
        } finally {
          try { fs.unlinkSync(envFilePath); } catch { /* ignore */ }
        }

        await prisma.project.update({
          where: { id },
          data: { containerId: newContainerId },
        });
      }

      res.json({ data: { customDomain: customDomain ?? null } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── POST /api/projects/:id/transfer ─────────────────────────────────────────

const transferProjectSchema = z.object({
  targetTeamId: z.string().uuid("targetTeamId must be a valid UUID"),
});

router.post(
  "/projects/:id/transfer",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;

    const parsed = transferProjectSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { targetTeamId } = parsed.data;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, name: true, slug: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      if (project.teamId === targetTeamId) {
        res.status(400).json({ error: "Project is already in the target team" });
        return;
      }

      const targetTeam = await prisma.team.findUnique({
        where: { id: targetTeamId },
        select: { id: true },
      });

      if (!targetTeam) {
        res.status(404).json({ error: "Target team not found" });
        return;
      }

      // Resolve slug collision in the target team
      let slug = project.slug;
      const existingSlugs = await prisma.project.findMany({
        where: { teamId: targetTeamId },
        select: { slug: true },
      });
      const slugSet = new Set(existingSlugs.map((p) => p.slug));

      if (slugSet.has(slug)) {
        let counter = 2;
        while (slugSet.has(`${slug}-${counter}`)) {
          counter++;
        }
        slug = `${slug}-${counter}`;
      }

      // Remove all project assignments (old-team member access) then update teamId + slug
      await prisma.$transaction([
        prisma.projectAssignment.deleteMany({ where: { projectId: id } }),
        prisma.project.update({
          where: { id },
          data: { teamId: targetTeamId, slug },
        }),
      ]);

      res.json({ data: { id: project.id, name: project.name, slug, teamId: targetTeamId } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      res.status(500).json({ error: message });
    }
  }
);

// ─── PUT /api/projects/:id/deploy-target ─────────────────────────────────────

const deployTargetSchema = z.object({
  deployTarget: z.enum(["docker", "coolify"], {
    errorMap: () => ({ message: 'deployTarget must be "docker" or "coolify"' }),
  }),
});

router.put(
  "/projects/:id/deploy-target",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    const parsed = deployTargetSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { deployTarget } = parsed.data;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkLeaderPermission(user.id, user.platformRole as PlatformRole, project.teamId);

      if (deployTarget === "coolify") {
        const coolifyConfig = await getCoolifyConfig();
        if (!coolifyConfig.coolifyUrl || !coolifyConfig.tokenIsSet) {
          res.status(400).json({ error: "Coolify not configured" });
          return;
        }
      }

      const updated = await prisma.project.update({
        where: { id },
        data: { deployTarget },
        select: { deployTarget: true },
      });

      res.json({ data: { deployTarget: updated.deployTarget } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── GET /api/projects/:id/rdeploy-yml ───────────────────────────────────────

router.get(
  "/projects/:id/rdeploy-yml",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: {
          id: true,
          teamId: true,
          slug: true,
          status: true,
          team: { select: { slug: true } },
        },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkMemberAccess(user.id, user.platformRole as PlatformRole, project.teamId);

      if (project.status === "pending") {
        res.status(400).json({ error: "Repo has not been cloned yet" });
        return;
      }

      const workspaceBase = process.env.RDEPLOY_WORKSPACE_DIR ?? ".rdeploy/workspaces";
      const repoPath = path.join(workspaceBase, project.team.slug, project.slug, "repo");

      let rdeployYml;
      try {
        rdeployYml = parseRdeployYml(repoPath);
      } catch (parseErr) {
        const message = parseErr instanceof Error ? parseErr.message : "Failed to parse rdeploy.yml";
        res.status(400).json({ error: `Invalid rdeploy.yml: ${message}` });
        return;
      }

      res.json({ data: rdeployYml });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

// ─── DELETE /api/projects/:id/webhook ────────────────────────────────────────

router.delete(
  "/projects/:id/webhook",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const user = req.user;

    try {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { id: true, teamId: true },
      });

      if (!project) {
        res.status(404).json({ error: "Project not found" });
        return;
      }

      await checkLeaderPermission(user.id, user.platformRole as PlatformRole, project.teamId);

      await prisma.project.update({
        where: { id },
        data: { webhookSecret: null },
      });

      res.json({ data: { message: "Webhook disabled" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      if (message === "Project not found") {
        res.status(404).json({ error: message });
      } else if (message === "Forbidden") {
        res.status(403).json({ error: message });
      } else {
        res.status(500).json({ error: message });
      }
    }
  }
);

export default router;
