import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import * as authService from "../services/auth.service";

const router = Router();

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
});

router.post("/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.errors[0].message });
    return;
  }

  try {
    const { token, user } = await authService.login(
      parsed.data.email,
      parsed.data.password
    );
    res.json({ data: { token, user } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    res.status(401).json({ error: message });
  }
});

router.get(
  "/me",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      const user = await authService.getMe(req.user.id);
      res.json({ data: { user } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to get user";
      res.status(404).json({ error: message });
    }
  }
);

router.post(
  "/change-password",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    try {
      await authService.changePassword(
        req.user.id,
        parsed.data.currentPassword,
        parsed.data.newPassword
      );
      res.json({ data: { message: "Password changed successfully" } });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to change password";
      res.status(400).json({ error: message });
    }
  }
);

export default router;
