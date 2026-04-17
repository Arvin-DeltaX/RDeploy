import { Router, Request, Response } from "express";
import { z } from "zod";
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
// Authorization is enforced in the service layer (leader role required).
// requireTeamRole cannot be applied here because the route uses :projectId, not :teamId.

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
// Authorization is enforced in the service layer (leader role required).
// requireTeamRole cannot be applied here because the route uses :projectId, not :teamId.

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
// Authorization is enforced in the service layer (leader role required).
// requireTeamRole cannot be applied here because the route uses :projectId, not :teamId.

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
        value: z.string(),
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

export default router;
