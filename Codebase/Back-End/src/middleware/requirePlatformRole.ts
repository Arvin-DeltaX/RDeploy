import { Request, Response, NextFunction } from "express";

export function requirePlatformRole(
  ...roles: string[]
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.platformRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
