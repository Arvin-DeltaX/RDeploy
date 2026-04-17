import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./lib/prisma";
import authRouter from "./routes/auth.routes";
import adminRouter from "./routes/admin.routes";
import teamsRouter from "./routes/teams.routes";
import projectsRouter from "./routes/projects.routes";
import { errorHandler } from "./middleware/errorHandler";
import { inspectContainer } from "./services/docker.service";
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
        select: { id: true, containerId: true, port: true },
      });

      for (const project of runningProjects) {
        try {
          if (!project.containerId) continue;

          const state = inspectContainer(project.containerId);

          if (!state) {
            // Container no longer exists
            await prisma.project.update({
              where: { id: project.id },
              data: { status: "failed", healthStatus: "unknown" },
            });
            continue;
          }

          if (!state.running) {
            await prisma.project.update({
              where: { id: project.id },
              data: {
                status: "failed",
                healthStatus: "unknown",
                exitCode: state.exitCode,
                restartCount: state.restartCount,
              },
            });
            continue;
          }

          // Container is running — health check
          const updateData: {
            restartCount: number;
            exitCode: number;
            healthStatus: "healthy" | "unhealthy";
          } = {
            restartCount: state.restartCount,
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
