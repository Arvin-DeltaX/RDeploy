import crypto from "crypto";
import { Router, Request, Response } from "express";
import express from "express";
import prisma from "../lib/prisma";
import { runDeployFlow } from "../services/deploy.service";

const router = Router();

// ─── POST /api/webhooks/github/:projectId ─────────────────────────────────────
// Public endpoint — no JWT auth. GitHub sends push events here.
// Uses raw body for HMAC-SHA256 signature verification.

router.post(
  "/github/:projectId",
  express.raw({ type: "application/json" }),
  async (req: Request, res: Response): Promise<void> => {
    const projectId = req.params.projectId as string;

    // Fetch project — need webhookSecret, status, and teamId
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        teamId: true,
        status: true,
        webhookSecret: true,
      },
    });

    if (!project || project.webhookSecret === null) {
      res.status(404).json({ error: "Webhook not configured for this project" });
      return;
    }

    // Verify HMAC-SHA256 signature
    const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined;
    if (!signatureHeader) {
      res.status(401).json({ error: "Missing X-Hub-Signature-256 header" });
      return;
    }

    const rawBody = req.body as Buffer;
    const expectedSig =
      "sha256=" +
      crypto
        .createHmac("sha256", project.webhookSecret)
        .update(rawBody)
        .digest("hex");

    const sigBuffer = Buffer.from(signatureHeader, "utf8");
    const expectedBuffer = Buffer.from(expectedSig, "utf8");

    if (
      sigBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
    ) {
      res.status(401).json({ error: "Invalid webhook signature" });
      return;
    }

    // Skip if a deploy is already in progress
    if (project.status === "building" || project.status === "cloning") {
      res.status(200).json({ data: { message: "Deploy already in progress, skipping" } });
      return;
    }

    // Resolve a user id to use as deployedBy — find platform owner or first team leader
    const systemUserId = await resolveSystemUserId(project.teamId);
    if (!systemUserId) {
      res.status(500).json({ error: "Could not resolve system user for webhook deploy" });
      return;
    }

    // Acknowledge immediately — deploy runs in background
    res.status(200).json({ data: { message: "Webhook received, deploy triggered" } });

    // Background redeploy — same logic as the /redeploy endpoint
    runDeployFlow(
      projectId,
      systemUserId,
      "user",  // actual role doesn't matter — skipPermissionCheck bypasses the check
      true,    // confirmed — skip localhost warning for webhook deploys
      ["running", "failed", "stopped", "ready"],
      systemUserId,
      true     // skipPermissionCheck — webhook is already authenticated via HMAC signature
    ).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[webhook] Deploy failed for project ${projectId}: ${message}`);
    });
  }
);

/**
 * Resolves a valid user id to attach to a webhook-triggered deployment.
 * Preference order:
 *   1. Platform owner
 *   2. Platform admin
 *   3. First leader of the team
 */
async function resolveSystemUserId(teamId: string): Promise<string | null> {
  // Try platform owner first
  const owner = await prisma.user.findFirst({
    where: { platformRole: "owner" },
    select: { id: true },
  });
  if (owner) return owner.id;

  // Try any platform admin
  const admin = await prisma.user.findFirst({
    where: { platformRole: "admin" },
    select: { id: true },
  });
  if (admin) return admin.id;

  // Fall back to first team leader
  const leader = await prisma.teamMember.findFirst({
    where: { teamId, role: "leader" },
    select: { userId: true },
  });
  if (leader) return leader.userId;

  return null;
}

export default router;
