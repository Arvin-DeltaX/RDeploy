import path from "path";
import fs from "fs";
import { spawnSync } from "child_process";
import prisma from "../lib/prisma";
import { slugify } from "../utils/slugify";

type PlatformRole = "owner" | "admin" | "user";

interface ProjectSummary {
  id: string;
  teamId: string;
  name: string;
  slug: string;
  repoUrl: string;
  dockerfilePath: string;
  status: string;
  healthStatus: string;
  port: number | null;
  containerId: string | null;
  restartCount: number;
  exitCode: number | null;
  createdAt: Date;
  updatedAt: Date;
  team: { id: string; name: string; slug: string };
}

interface ProjectAssignmentInfo {
  id: string;
  projectId: string;
  userId: string;
  assignedAt: Date;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
}

async function generateUniqueProjectSlug(teamId: string, name: string): Promise<string> {
  const base = slugify(name);
  const existing = await prisma.project.findUnique({ where: { teamId_slug: { teamId, slug: base } } });
  if (!existing) return base;

  let suffix = 2;
  while (true) {
    const candidate = `${base}-${suffix}`;
    const conflict = await prisma.project.findUnique({ where: { teamId_slug: { teamId, slug: candidate } } });
    if (!conflict) return candidate;
    suffix++;
  }
}

export async function createProject(
  teamId: string,
  name: string,
  repoUrl: string,
  dockerfilePath: string
): Promise<ProjectSummary> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new Error("Team not found");
  }

  const slug = await generateUniqueProjectSlug(teamId, name);

  const project = await prisma.project.create({
    data: { teamId, name, slug, repoUrl, dockerfilePath },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });

  return project;
}

export async function listTeamProjects(
  teamId: string,
  requesterId: string,
  requesterRole: PlatformRole
): Promise<ProjectSummary[]> {
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) {
    throw new Error("Team not found");
  }

  // Non-platform-admin users must be a team member to list projects
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId } },
    });
    if (!member) {
      throw new Error("Team not found");
    }
  }

  return prisma.project.findMany({
    where: { teamId },
    include: { team: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function listAllProjects(
  requesterId: string,
  requesterRole: PlatformRole
): Promise<ProjectSummary[]> {
  if (requesterRole === "owner" || requesterRole === "admin") {
    return prisma.project.findMany({
      include: { team: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  // Regular users: only projects belonging to teams they are members of
  const memberships = await prisma.teamMember.findMany({
    where: { userId: requesterId },
    select: { teamId: true },
  });

  const teamIds = memberships.map((m: { teamId: string }) => m.teamId);

  return prisma.project.findMany({
    where: { teamId: { in: teamIds } },
    include: { team: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getProject(
  projectId: string,
  requesterId: string,
  requesterRole: PlatformRole
): Promise<ProjectSummary> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member) {
      throw new Error("Project not found");
    }
  }

  return project;
}

function getWorkspaceBase(): string {
  return process.env.RDEPLOY_WORKSPACE_DIR ?? ".rdeploy/workspaces";
}

function getProjectWorkspace(teamSlug: string, projectSlug: string): string {
  return path.join(getWorkspaceBase(), teamSlug, projectSlug);
}

function stopAndRemoveContainer(containerId: string): void {
  try {
    spawnSync('docker', ['stop', containerId], { stdio: 'ignore' });
  } catch {
    // container may already be stopped — ignore
  }
  try {
    spawnSync('docker', ['rm', containerId], { stdio: 'ignore' });
  } catch {
    // container may not exist — ignore
  }
}

function removeDockerImage(projectSlug: string, teamSlug: string): void {
  try {
    spawnSync('docker', ['rmi', `rdeploy-${projectSlug}-${teamSlug}`], { stdio: 'ignore' });
  } catch {
    // image may not exist — ignore
  }
}

function removeWorkspace(workspacePath: string): void {
  try {
    const resolved = path.resolve(workspacePath);
    const base = path.resolve(getWorkspaceBase());
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new Error('Path traversal attempt detected');
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  } catch {
    // workspace may not exist — ignore
  }
}

export async function deleteProject(
  projectId: string,
  requesterId: string,
  requesterRole: PlatformRole
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { team: { select: { id: true, name: true, slug: true } } },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Permission check: regular users must be a leader on the team
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member || member.role !== "leader") {
      throw new Error("Forbidden");
    }
  }

  // Stop and remove Docker container if one is running
  if (project.containerId) {
    stopAndRemoveContainer(project.containerId);
  }

  // Remove Docker image
  removeDockerImage(project.slug, project.team.slug);

  // Remove workspace directory
  const workspacePath = getProjectWorkspace(project.team.slug, project.slug);
  removeWorkspace(workspacePath);

  // Delete all DB records (cascade handles envVars and assignments)
  await prisma.project.delete({ where: { id: projectId } });
}

export async function assignMembers(
  projectId: string,
  userIds: string[],
  requesterId: string,
  requesterRole: PlatformRole
): Promise<ProjectAssignmentInfo[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  // Permission: must be leader-level on the team (or platform admin/owner)
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member || member.role !== "leader") {
      throw new Error("Forbidden");
    }
  }

  // Validate all userIds exist and are team members
  for (const userId of userIds) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const teamMember = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId, teamId: project.teamId } },
    });
    if (!teamMember) {
      throw new Error(`User ${userId} is not a member of this team`);
    }
  }

  // Upsert assignments (skip duplicates)
  const assignments: ProjectAssignmentInfo[] = [];
  for (const userId of userIds) {
    const existing = await prisma.projectAssignment.findUnique({
      where: { projectId_userId: { projectId, userId } },
    });

    if (!existing) {
      const assignment = await prisma.projectAssignment.create({
        data: { projectId, userId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
      assignments.push(assignment);
    } else {
      const assignment = await prisma.projectAssignment.findUnique({
        where: { projectId_userId: { projectId, userId } },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      });
      if (assignment) assignments.push(assignment);
    }
  }

  return assignments;
}

export async function removeProjectMember(
  projectId: string,
  userId: string,
  requesterId: string,
  requesterRole: PlatformRole
): Promise<void> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  // Permission: must be leader-level on the team (or platform admin/owner)
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member || member.role !== "leader") {
      throw new Error("Forbidden");
    }
  }

  const assignment = await prisma.projectAssignment.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });

  if (!assignment) {
    throw new Error("User is not assigned to this project");
  }

  await prisma.projectAssignment.delete({
    where: { projectId_userId: { projectId, userId } },
  });
}

export async function listProjectMembers(
  projectId: string,
  requesterId: string,
  requesterRole: PlatformRole
): Promise<ProjectAssignmentInfo[]> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    throw new Error("Project not found");
  }

  // Any team member can view project members
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member) {
      throw new Error("Project not found");
    }
  }

  return prisma.projectAssignment.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { assignedAt: "asc" },
  });
}
