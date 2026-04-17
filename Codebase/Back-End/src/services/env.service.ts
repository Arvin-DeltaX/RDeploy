import prisma from "../lib/prisma";
import { encrypt } from "../utils/encryption";

type PlatformRole = "owner" | "admin" | "user";

interface EnvVarSummary {
  id: string;
  key: string;
  isSecret: boolean;
  hasValue: boolean;
}

interface EnvVarUpdate {
  id: string;
  value: string;
  isSecret: boolean;
}

export async function getEnvVars(
  projectId: string,
  requesterId: string,
  requesterRole: PlatformRole
): Promise<EnvVarSummary[]> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, teamId: true },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Any team member may view env vars (but never the values)
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member) {
      throw new Error("Forbidden");
    }
  }

  const envVars = await prisma.envVar.findMany({
    where: { projectId },
    orderBy: { key: "asc" },
    select: { id: true, key: true, isSecret: true, value: true },
  });

  return envVars.map((v: { id: string; key: string; isSecret: boolean; value: string }) => ({
    id: v.id,
    key: v.key,
    isSecret: v.isSecret,
    hasValue: v.value !== "",
  }));
}

export async function updateEnvVars(
  projectId: string,
  vars: EnvVarUpdate[],
  requesterId: string,
  requesterRole: PlatformRole
): Promise<number> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, teamId: true },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  // Only owner/admin, leader, or elder may update env vars
  if (requesterRole === "user") {
    const member = await prisma.teamMember.findUnique({
      where: { userId_teamId: { userId: requesterId, teamId: project.teamId } },
    });
    if (!member || (member.role !== "leader" && member.role !== "elder")) {
      throw new Error("Forbidden");
    }
  }

  let updated = 0;

  for (const v of vars) {
    // Verify the env var belongs to this project
    const existing = await prisma.envVar.findFirst({
      where: { id: v.id, projectId },
    });

    if (!existing) {
      throw new Error(`EnvVar ${v.id} not found on this project`);
    }

    const encryptedValue = v.value !== "" ? encrypt(v.value) : "";

    await prisma.envVar.update({
      where: { id: v.id },
      data: { value: encryptedValue, isSecret: v.isSecret },
    });

    updated++;
  }

  return updated;
}
