import { PrismaClient, PlatformRole } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const password = process.env.SEED_OWNER_PASSWORD;
  if (!password) {
    console.error("FATAL: SEED_OWNER_PASSWORD environment variable is not set");
    process.exit(1);
  }
  const hashedPassword = await bcrypt.hash(password, 10);

  const owner = await prisma.user.upsert({
    where: { email: "arvin@thesx.co" },
    update: {},
    create: {
      email: "arvin@thesx.co",
      name: "Arvin",
      password: hashedPassword,
      platformRole: PlatformRole.owner,
      mustChangePassword: false,
    },
  });

  console.log(`Seeded owner: ${owner.email} (${owner.id})`);
}

main()
  .catch((e: Error) => {
    console.error("Seed failed:", e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
