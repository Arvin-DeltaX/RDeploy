import { Router, Request, Response } from "express";
import { z } from "zod";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth";
import { requireTeamRole } from "../middleware/requireTeamRole";
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
import { cloneRepo } from "../services/git.service";
import { getEnvVars, updateEnvVars } from "../services/env.service";
import {
  stopContainer,
  removeContainer,
  inspectContainer,
  streamContainerLogs,
} from "../services/docker.service";
import {
  runDeployFlow,
  checkLeaderPermission,
  checkMemberAccess,
} from "../services/deploy.service";
import { encrypt } from "../utils/encryption";
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
      res.json({ data: result });
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

      if (!project.containerId) {
        res.status(400).json({ error: "No container running" });
        return;
      }

      stopContainer(project.containerId);
      removeContainer(project.containerId);

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

export default router;
