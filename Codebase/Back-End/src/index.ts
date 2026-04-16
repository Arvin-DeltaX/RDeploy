import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import prisma from "./lib/prisma";
import authRouter from "./routes/auth.routes";
import adminRouter from "./routes/admin.routes";
import teamsRouter from "./routes/teams.routes";
import projectsRouter from "./routes/projects.routes";

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

async function start(): Promise<void> {
  try {
    await prisma.$connect();
    console.log("Database connected");

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

start();

export { app };
