import prisma from "../lib/prisma";

export async function getAvailablePort(): Promise<number> {
  const start = parseInt(process.env.PORT_RANGE_START ?? "3001", 10);
  const end = parseInt(process.env.PORT_RANGE_END ?? "4000", 10);

  const usedPortRecords = await prisma.project.findMany({
    where: { port: { not: null } },
    select: { port: true },
  });

  const usedPorts = new Set(
    usedPortRecords
      .map((p: { port: number | null }) => p.port)
      .filter((p: number | null): p is number => p !== null)
  );

  for (let port = start; port <= end; port++) {
    if (!usedPorts.has(port)) {
      return port;
    }
  }

  throw new Error("No available ports");
}
