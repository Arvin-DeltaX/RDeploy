import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import prisma from "../lib/prisma";

interface UserPublic {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  platformRole: string;
  mustChangePassword: boolean;
  githubId: string | null;
  githubUsername: string | null;
  emailNotifications: boolean;
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
  emailNotifications: boolean;
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
    emailNotifications: user.emailNotifications,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function generateToken(user: UserPublic): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET is not configured");
  }

  return jwt.sign(
    { id: user.id, email: user.email, platformRole: user.platformRole },
    secret,
    { expiresIn: "7d" }
  );
}

export async function login(
  email: string,
  password: string
): Promise<{ token: string; user: UserPublic }> {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    throw new Error("Invalid email or password");
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    throw new Error("Invalid email or password");
  }

  const publicUser = toPublicUser(user);
  const token = generateToken(publicUser);

  return { token, user: publicUser };
}

export async function getMe(userId: string): Promise<UserPublic> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error("User not found");
  }

  return toPublicUser(user);
}

export async function updateNotificationPreferences(
  userId: string,
  emailNotifications: boolean
): Promise<{ emailNotifications: boolean }> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: { emailNotifications },
    select: { emailNotifications: true },
  });
  return { emailNotifications: user.emailNotifications };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw new Error("User not found");
  }

  const passwordMatch = await bcrypt.compare(currentPassword, user.password);
  if (!passwordMatch) {
    throw new Error("Current password is incorrect");
  }

  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: userId },
    data: {
      password: hashedPassword,
      mustChangePassword: false,
    },
  });
}
