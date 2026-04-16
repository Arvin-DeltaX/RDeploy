import prisma from "../lib/prisma";
import { slugify } from "../utils/slugify";

type PlatformRole = "owner" | "admin" | "user";
type TeamRole = "leader" | "elder" | "member";

interface UserInfo {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

interface TeamMemberInfo {
  id: string;
  userId: string;
  teamId: string;
  role: string;
  joinedAt: Date;
  user: UserInfo;
}

interface TeamDetail {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
  members: TeamMemberInfo[];
}

interface TeamSummary {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  updatedAt: Date;
}

async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugify(name);
  const existing = await prisma.team.findUnique({ where: { slug: base } });
  if (!existing) return base;

  let suffix = 2;
  while (true) {
    const candidate = `${base}-${suffix}`;
    const conflict = await prisma.team.findUnique({ where: { slug: candidate } });
    if (!conflict) return candidate;
    suffix++;
  }
}

export async function createTeam(name: string): Promise<TeamDetail> {
  const slug = await generateUniqueSlug(name);

  const team = await prisma.team.create({
    data: { name, slug },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  return team;
}

export async function listTeams(
  userId: string,
  platformRole: PlatformRole
): Promise<TeamSummary[]> {
  if (platformRole === "owner" || platformRole === "admin") {
    return prisma.team.findMany({ orderBy: { createdAt: "asc" } });
  }

  const memberships = await prisma.teamMember.findMany({
    where: { userId },
    include: { team: true },
    orderBy: { joinedAt: "asc" },
  });

  return memberships.map((m: { team: TeamSummary }) => m.team);
}

export async function getTeam(teamId: string): Promise<TeamDetail> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
    },
  });

  if (!team) {
    throw new Error("Team not found");
  }

  return team;
}

export async function deleteTeam(teamId: string): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new Error("Team not found");
  }

  await prisma.team.delete({ where: { id: teamId } });
}

export async function addMember(
  teamId: string,
  userId: string,
  role: TeamRole
): Promise<TeamMemberInfo> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new Error("Team not found");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("User not found");
  }

  const existing = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (existing) {
    throw new Error("User is already a member of this team");
  }

  const member = await prisma.teamMember.create({
    data: { userId, teamId, role },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
  });

  return member;
}

export async function removeMember(teamId: string, userId: string): Promise<void> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new Error("Team not found");
  }

  const member = await prisma.teamMember.findUnique({
    where: { userId_teamId: { userId, teamId } },
  });
  if (!member) {
    throw new Error("User is not a member of this team");
  }

  await prisma.teamMember.delete({
    where: { userId_teamId: { userId, teamId } },
  });
}
