import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requirePlatformRole } from "../middleware/requirePlatformRole";
import * as teamsService from "../services/teams.service";

type PlatformRole = "owner" | "admin" | "user";
type TeamRole = "leader" | "elder" | "member";

const router = Router();

const createTeamSchema = z.object({
  name: z.string().min(1, "Name is required"),
});

const addMemberSchema = z.object({
  userId: z.string().min(1, "userId is required"),
  role: z.enum(["leader", "elder", "member"]),
});

router.post(
  "/",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createTeamSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const team = await teamsService.createTeam(parsed.data.name);
      res.status(201).json({ data: { team } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create team";
      res.status(400).json({ error: message });
    }
  }
);

router.get(
  "/",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const teams = await teamsService.listTeams(
        req.user.id,
        req.user.platformRole as PlatformRole
      );
      res.json({ data: { teams } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list teams";
      res.status(500).json({ error: message });
    }
  }
);

router.get(
  "/:id",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const team = await teamsService.getTeam(req.params["id"] as string);
      res.json({ data: { team } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get team";
      const status = err instanceof Error && err.message === "Team not found" ? 404 : 500;
      res.status(status).json({ error: message });
    }
  }
);

router.delete(
  "/:id",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await teamsService.deleteTeam(req.params["id"] as string);
      res.json({ data: { message: "Team deleted successfully" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete team";
      const status = err instanceof Error && err.message === "Team not found" ? 404 : 400;
      res.status(status).json({ error: message });
    }
  }
);

router.post(
  "/:id/members",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = addMemberSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const member = await teamsService.addMember(
        req.params["id"] as string,
        parsed.data.userId,
        parsed.data.role as TeamRole
      );
      res.status(201).json({ data: { member } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add member";
      const status =
        err instanceof Error &&
        (err.message === "Team not found" || err.message === "User not found")
          ? 404
          : 400;
      res.status(status).json({ error: message });
    }
  }
);

router.delete(
  "/:id/members/:userId",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await teamsService.removeMember(
        req.params["id"] as string,
        req.params["userId"] as string
      );
      res.json({ data: { message: "Member removed successfully" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to remove member";
      const status =
        err instanceof Error &&
        (err.message === "Team not found" ||
          err.message === "User is not a member of this team")
          ? 404
          : 400;
      res.status(status).json({ error: message });
    }
  }
);

export default router;
