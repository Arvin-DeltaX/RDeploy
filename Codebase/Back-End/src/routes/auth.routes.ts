import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/requireAuth";
import * as authService from "../services/auth.service";
import * as githubService from "../services/github.service";

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

// GET /api/auth/github — return GitHub OAuth URL as JSON
// Frontend calls this via axios (JWT in Authorization header), then redirects browser to the returned URL.
// This avoids exposing the JWT as a browser URL query parameter.
router.get(
  "/github",
  requireAuth,
  (req: Request, res: Response): void => {
    try {
      const clientId = process.env.GITHUB_CLIENT_ID;
      const callbackUrl = process.env.GITHUB_CALLBACK_URL;

      if (!clientId || !callbackUrl) {
        res.status(500).json({ error: "GitHub OAuth is not configured" });
        return;
      }

      const state = githubService.generateOAuthStateToken(req.user.id);
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: callbackUrl,
        scope: "repo",
        state,
      });

      const url = `https://github.com/login/oauth/authorize?${params.toString()}`;
      res.json({ data: { url } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start GitHub OAuth";
      res.status(500).json({ error: message });
    }
  }
);

// GET /api/auth/github/callback — complete GitHub OAuth link
router.get(
  "/github/callback",
  async (req: Request, res: Response): Promise<void> => {
    const platformUrl = process.env.RDEPLOY_PLATFORM_URL ?? "https://rdeploy.deltaxs.co";
    const { code, state } = req.query;

    if (typeof state !== "string" || typeof code !== "string") {
      res.redirect(`${platformUrl}/profile?error=github_state_invalid`);
      return;
    }

    let userId: string;
    try {
      userId = githubService.verifyOAuthStateToken(state);
    } catch {
      res.redirect(`${platformUrl}/profile?error=github_state_invalid`);
      return;
    }

    try {
      const accessToken = await githubService.exchangeCodeForToken(code);
      await githubService.linkGitHubAccount(userId, accessToken);
      res.redirect(`${platformUrl}/profile?github=connected`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown";
      if (message === "github_already_linked") {
        res.redirect(`${platformUrl}/profile?error=github_already_linked`);
      } else {
        res.redirect(`${platformUrl}/profile?error=github_connect_failed`);
      }
    }
  }
);

// DELETE /api/auth/github — disconnect GitHub account
router.delete(
  "/github",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    try {
      await githubService.disconnectGitHub(req.user.id);
      res.json({ data: { message: "GitHub account disconnected" } });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to disconnect GitHub";
      res.status(500).json({ error: message });
    }
  }
);

export default router;
