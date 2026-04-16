import bcrypt from "bcrypt";
import prisma from "../lib/prisma";

type PlatformRole = "owner" | "admin" | "user";

interface UserPublic {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  platformRole: string;
  mustChangePassword: boolean;
  githubId: string | null;
  githubUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function toPublicUser(user: {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  platformRole: string;
  mustChangePassword: boolean;
  githubId: string | null;
  githubUsername: string | null;
  createdAt: Date;
  updatedAt: Date;
}): UserPublic {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    platformRole: user.platformRole,
    mustChangePassword: user.mustChangePassword,
    githubId: user.githubId,
    githubUsername: user.githubUsername,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}


export async function createUser(
  creatorRole: PlatformRole,
  email: string,
  name: string,
  platformRole: PlatformRole = "user"
): Promise<UserPublic> {
  if (creatorRole === "admin" && platformRole === "owner") {
    throw new Error("Admins cannot create owner accounts");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("A user with that email already exists");
  }

  const defaultPassword = process.env.DEFAULT_USER_PASSWORD;
  if (!defaultPassword) {
    throw new Error("DEFAULT_USER_PASSWORD env var is not set");
  }

  const hashedPassword = await bcrypt.hash(defaultPassword, 12);

  const user = await prisma.user.create({
    data: {
      email,
      name,
      password: hashedPassword,
      platformRole,
      mustChangePassword: true,
    },
  });

  return toPublicUser(user);
}

export async function listUsers(): Promise<UserPublic[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
  });
  return users.map(toPublicUser);
}

export async function updateUserRole(
  actorRole: PlatformRole,
  targetUserId: string,
  platformRole: PlatformRole
): Promise<UserPublic> {
  if (actorRole === "admin" && platformRole === "owner") {
    throw new Error("Admins cannot promote users to owner");
  }

  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (actorRole === "admin" && user.platformRole === "owner") {
    throw new Error("Admins cannot modify owner accounts");
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { platformRole },
  });

  return toPublicUser(updated);
}

export async function deleteUser(actorRole: PlatformRole, userId: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  if (actorRole === "admin" && user.platformRole === "owner") {
    throw new Error("Admins cannot delete owner accounts");
  }

  await prisma.user.delete({ where: { id: userId } });
}
