import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./lib/prisma";
import authRouter from "./routes/auth.routes";
import adminRouter from "./routes/admin.routes";
import teamsRouter from "./routes/teams.routes";
import projectsRouter from "./routes/projects.routes";
import webhookRouter from "./routes/webhook.routes";
import { errorHandler } from "./middleware/errorHandler";
import { inspectContainer, startContainer } from "./services/docker.service";
import { healthCheckHttp } from "./services/deploy.service";

dotenv.config();

// Validate required environment variables before starting
const REQUIRED_ENV_VARS = ["JWT_SECRET", "ENCRYPTION_KEY"] as const;
for (const key of REQUIRED_ENV_VARS) {
  if (!process.env[key]) {
    console.error(`FATAL: Required environment variable ${key} is not set`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin, curl, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
// Webhook routes must be registered before express.json() so the raw body
// middleware applied per-route can read the unparsed request body for HMAC verification.
app.use("/api/webhooks", webhookRouter);

app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ data: { status: "ok" } });
});

app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/teams", teamsRouter);
app.use("/api", projectsRouter);

// 404 catch-all — must be after all routes
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Global error handler — must be last, after the 404 handler
app.use(errorHandler);

function startHealthPoller(): void {
  setInterval(async () => {
    try {
      const runningProjects = await prisma.project.findMany({
        where: { status: "running" },
        select: {
          id: true,
          containerId: true,
          port: true,
          restartCount: true,
          replicas: {
            where: { status: "running" },
            select: { id: true, containerId: true, port: true },
          },
        },
      });

      for (const project of runningProjects) {
        try {
          // Check replica containers when replicas are tracked
          if (project.replicas.length > 0) {
            let anyRunning = false;
            let allFailed = true;

            for (const replica of project.replicas) {
              if (!replica.containerId) continue;

              const state = inspectContainer(replica.containerId);

              if (!state || !state.running) {
                await prisma.projectReplica.update({
                  where: { id: replica.id },
                  data: { status: "failed" },
                });
              } else {
                anyRunning = true;
                allFailed = false;

                await prisma.projectReplica.update({
                  where: { id: replica.id },
                  data: { status: "running" },
                });
              }
            }

            // Determine overall project health from first replica's port
            const firstRunningReplica = project.replicas.find((r) => r.port !== null);
            let projectHealthStatus: "healthy" | "unhealthy" = "unhealthy";

            if (firstRunningReplica?.port !== null && firstRunningReplica?.port !== undefined) {
              const healthy = await healthCheckHttp(firstRunningReplica.port);
              projectHealthStatus = healthy ? "healthy" : "unhealthy";
            }

            if (allFailed) {
              await prisma.project.update({
                where: { id: project.id },
                data: { status: "failed", healthStatus: "unknown" },
              });
            } else if (anyRunning) {
              await prisma.project.update({
                where: { id: project.id },
                data: { healthStatus: projectHealthStatus },
              });
            }

            continue;
          }

          // Legacy single-container path (no replica records)
          if (!project.containerId) continue;

          const state = inspectContainer(project.containerId);

          if (!state) {
            await prisma.project.update({
              where: { id: project.id },
              data: { status: "failed", healthStatus: "unknown" },
            });
            continue;
          }

          if (!state.running) {
            // Clean stop (exit code 0) — mark stopped, no restart
            if (state.exitCode === 0) {
              await prisma.project.update({
                where: { id: project.id },
                data: {
                  status: "stopped",
                  healthStatus: "unknown",
                  exitCode: state.exitCode,
                },
              });
              continue;
            }

            // Crash (non-zero exit code) — auto-restart once
            if (project.restartCount === 0) {
              const restarted = startContainer(project.containerId);
              if (restarted) {
                console.log(`Auto-restarted crashed container for project ${project.id}`);
                await prisma.project.update({
                  where: { id: project.id },
                  data: {
                    restartCount: 1,
                    healthStatus: "unknown",
                  },
                });
              } else {
                console.error(`Failed to restart container for project ${project.id}`);
                await prisma.project.update({
                  where: { id: project.id },
                  data: {
                    status: "failed",
                    healthStatus: "unknown",
                    exitCode: state.exitCode,
                  },
                });
              }
            } else {
              await prisma.project.update({
                where: { id: project.id },
                data: {
                  status: "failed",
                  healthStatus: "unknown",
                  exitCode: state.exitCode,
                },
              });
            }
            continue;
          }

          // Container is running — health check
          const updateData: {
            exitCode: number;
            healthStatus: "healthy" | "unhealthy";
          } = {
            exitCode: state.exitCode,
            healthStatus: "unhealthy",
          };

          if (project.port !== null) {
            const healthy = await healthCheckHttp(project.port);
            updateData.healthStatus = healthy ? "healthy" : "unhealthy";
          }

          await prisma.project.update({
            where: { id: project.id },
            data: updateData,
          });
        } catch (err) {
          console.error(`Health poller error for project ${project.id}:`, err);
        }
      }
    } catch (err) {
      console.error("Health poller query error:", err);
    }
  }, 60_000);
}

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      startHealthPoller();
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();

export { app };
