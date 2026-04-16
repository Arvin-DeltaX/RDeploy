import { Request, Response, NextFunction } from "express";
import prisma from "../lib/prisma";

type TeamRole = "leader" | "elder" | "member";

const ROLE_HIERARCHY: Record<TeamRole, number> = {
  leader: 3,
  elder: 2,
  member: 1,
};

export function requireTeamRole(
  minimumRole: TeamRole
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // Owner and admin bypass all team role checks
    if (user.platformRole === "owner" || user.platformRole === "admin") {
      next();
      return;
    }

    const teamId = req.params.teamId ?? req.params.id;

    if (!teamId) {
      res.status(400).json({ error: "Team ID is required" });
      return;
    }

    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: user.id, teamId } },
    });

    if (!member) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const memberRole = member.role as TeamRole;
    if (ROLE_HIERARCHY[memberRole] < ROLE_HIERARCHY[minimumRole]) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    next();
  };
}
