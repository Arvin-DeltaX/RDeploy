import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import { requirePlatformRole } from "../middleware/requirePlatformRole";
import * as adminService from "../services/admin.service";

type PlatformRole = "owner" | "admin" | "user";

const router = Router();

const createUserSchema = z.object({
  email: z.string().email("Invalid email address"),
  name: z.string().min(1, "Name is required"),
  platformRole: z.enum(["owner", "admin", "user"]).optional(),
});

const updateRoleSchema = z.object({
  platformRole: z.enum(["owner", "admin", "user"]),
});

router.post(
  "/users",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const user = await adminService.createUser(
        req.user.platformRole as PlatformRole,
        parsed.data.email,
        parsed.data.name,
        parsed.data.platformRole as PlatformRole | undefined
      );
      res.status(201).json({ data: { user } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create user";
      res.status(400).json({ error: message });
    }
  }
);

router.get(
  "/users",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (_req: Request, res: Response): Promise<void> => {
    try {
      const users = await adminService.listUsers();
      res.json({ data: { users } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to list users";
      res.status(500).json({ error: message });
    }
  }
);

router.put(
  "/users/:id",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      const user = await adminService.updateUserRole(
        req.user.platformRole as PlatformRole,
        req.params["id"] as string,
        parsed.data.platformRole as PlatformRole
      );
      res.json({ data: { user } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update user";
      const status = err instanceof Error && err.message === "User not found" ? 404 : 400;
      res.status(status).json({ error: message });
    }
  }
);

router.delete(
  "/users/:id",
  requireAuth,
  requirePlatformRole("owner", "admin"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      await adminService.deleteUser(req.params["id"] as string);
      res.json({ data: { message: "User deleted successfully" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      const status = err instanceof Error && err.message === "User not found" ? 404 : 400;
      res.status(status).json({ error: message });
    }
  }
);

export default router;
