import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL environment variable is required');
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main(): Promise<void> {
  // Define all permissions
  const permissions = [
    { key: 'users:read', name: 'Read Users', description: 'View any user profile' },
    { key: 'users:write', name: 'Write Users', description: 'Create or update users' },
    { key: 'users:delete', name: 'Delete Users', description: 'Delete users' },
    { key: 'users:assign-role', name: 'Assign Role', description: 'Assign roles to users' },
    { key: 'roles:read', name: 'Read Roles', description: 'View roles and permissions' },
    { key: 'roles:write', name: 'Write Roles', description: 'Create roles and assign permissions' },
    { key: 'roles:delete', name: 'Delete Roles', description: 'Delete roles' },
    { key: 'sessions:read', name: 'Read Sessions', description: 'View all user sessions' },
    { key: 'sessions:terminate', name: 'Terminate Sessions', description: 'Terminate any user session' },
  ];

  // Upsert permissions
  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { key: perm.key },
      update: {},
      create: perm,
    });
  }

  // Create admin role with all permissions
  const adminRole = await prisma.role.upsert({
    where: { name: 'admin' },
    update: {},
    create: {
      name: 'admin',
      description: 'Administrator with full access',
    },
  });

  // Assign all permissions to admin role
  const allPermissions = await prisma.permission.findMany();
  for (const perm of allPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: adminRole.id,
          permissionId: perm.id,
        },
      },
      update: {},
      create: {
        roleId: adminRole.id,
        permissionId: perm.id,
      },
    });
  }

  // Create user role with no permissions
  await prisma.role.upsert({
    where: { name: 'user' },
    update: {},
    create: {
      name: 'user',
      description: 'Default user role with basic access',
    },
  });

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
