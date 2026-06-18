import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const perms = await prisma.permission.findMany({
    where: { key: { in: ['sessions:read', 'sessions:terminate'] } },
  });
  console.log(JSON.stringify(perms, null, 2));
  await prisma.$disconnect();
}

main();
