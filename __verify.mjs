import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
const perms = await p.permission.findMany({
  where: { key: { in: ['sessions:read', 'sessions:terminate'] } },
});
console.log(JSON.stringify(perms, null, 2));
await p.$disconnect();
