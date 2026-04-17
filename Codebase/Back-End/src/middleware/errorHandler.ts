import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  // next is required by Express for error-handling middleware (4-arg signature)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  console.error(`[${req.method}] ${req.path}`, err);

  // Zod validation error
  if (err instanceof ZodError) {
    const messages = err.errors.map((e) => e.message).join(", ");
    res.status(400).json({ error: messages });
    return;
  }

  // Prisma known request errors (duck-typed by error code — P-prefixed codes are Prisma's)
  if (typeof err.code === "string" && err.code.startsWith("P")) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "A record with that value already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Record not found" });
      return;
    }
  }

  // Errors with an explicit statusCode (intentionally user-facing)
  if (err.statusCode) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  // Fallback: 500 — never expose internal error details
  res.status(500).json({ error: "Internal server error" });
}
