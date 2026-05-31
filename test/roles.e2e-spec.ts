import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { AppModule } from '@/app.module';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { hash } from 'bcryptjs';

interface ApiErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code: string;
}

interface LoginResponse {
  accessToken: string;
  user: {
    id: string;
    email: string;
    role: { id: string; name: string };
  };
}

interface RoleResponse {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

describe('Roles & Permissions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useLogger(app.get(Logger));
    app.useGlobalInterceptors(new LoggerErrorInterceptor());
    app.useGlobalFilters(new AppExceptionFilter(app.get(Logger)));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.use(cookieParser());
    app.enableCors();
    app.setGlobalPrefix('api');
    await app.init();

    prisma = app.get(PrismaService);

    const suiteUsers = await prisma.user.findMany({ where: { email: { startsWith: 'roles-' } }, select: { id: true } });
    const suiteUserIds = suiteUsers.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: suiteUserIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'roles-' } } });
    await prisma.verificationToken.deleteMany({ where: { userId: { in: suiteUserIds } } });
  });

  beforeEach(async () => {
    const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });
    const hashedPassword = await hash('AdminPass1', 12);
    await prisma.user.create({
      data: {
        email: 'roles-admin@example.com',
        password: hashedPassword,
        isVerified: true,
        roleId: adminRole!.id,
      },
    });

    const loginResponse = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({ email: 'roles-admin@example.com', password: 'AdminPass1' })
      .expect(200);
    adminToken = (loginResponse.body as LoginResponse).accessToken;
  });

  afterEach(async () => {
    const suiteUsers = await prisma.user.findMany({ where: { email: { startsWith: 'roles-' } }, select: { id: true } });
    const suiteUserIds = suiteUsers.map((u) => u.id);
    await prisma.session.deleteMany({ where: { userId: { in: suiteUserIds } } });
    await prisma.verificationToken.deleteMany({ where: { userId: { in: suiteUserIds } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: 'roles-' } } });
    await prisma.role.deleteMany({ where: { name: { notIn: ['admin', 'user'] } } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/roles', () => {
    it('returns paginated roles for admin', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<RoleResponse>;
      expect(body.data).toBeDefined();
      expect(body.meta).toBeDefined();
      expect(body.meta.total).toBeGreaterThanOrEqual(2);
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(25);

      const roleNames = body.data.map((r) => r.name);
      expect(roleNames).toContain('admin');
      expect(roleNames).toContain('user');
    });

    it('returns 401 without auth token', async () => {
      await request(app.getHttpServer() as Server)
        .get('/api/roles')
        .expect(401);
    });
  });

  describe('GET /api/roles/:id', () => {
    it('returns a role by id', async () => {
      const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
        select: { id: true },
      });

      const response = await request(app.getHttpServer() as Server)
        .get(`/api/roles/${adminRole!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as RoleResponse;
      expect(body.name).toBe('admin');
      expect(body.permissions).toBeInstanceOf(Array);
      expect(body.permissions.length).toBeGreaterThan(0);
    });

    it('returns 404 for nonexistent role', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/roles/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect((response.body as ApiErrorResponse).code).toBe('ROLE_NOT_FOUND');
    });
  });

  describe('POST /api/roles', () => {
    it('creates a new role with permissions', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'editor',
          description: 'Can edit content',
          permissions: ['roles:read'],
        })
        .expect(201);

      const body = response.body as RoleResponse;
      expect(body.name).toBe('editor');
      expect(body.description).toBe('Can edit content');
      expect(body.permissions).toContain('roles:read');
    });

    it('returns 409 for duplicate role name', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'admin', permissions: [] })
        .expect(409);
    });

    it('returns 400 for missing name', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ permissions: [] })
        .expect(400);
    });
  });

  describe('PATCH /api/roles/:id', () => {
    it('updates a role description', async () => {
      const createResponse = await request(app.getHttpServer() as Server)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'editor', permissions: [] })
        .expect(201);

      const roleId = (createResponse.body as RoleResponse).id;

      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect((response.body as RoleResponse).description).toBe('Updated description');
    });

    it('returns 404 for nonexistent role', async () => {
      await request(app.getHttpServer() as Server)
        .patch('/api/roles/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'new-name' })
        .expect(404);
    });
  });

  describe('DELETE /api/roles/:id', () => {
    it('deletes a non-system role', async () => {
      const createResponse = await request(app.getHttpServer() as Server)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'temp-role', permissions: [] })
        .expect(201);

      const roleId = (createResponse.body as RoleResponse).id;

      await request(app.getHttpServer() as Server)
        .delete(`/api/roles/${roleId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);
    });

    it('returns 409 for system role deletion', async () => {
      const adminRole = await prisma.role.findUnique({ where: { name: 'admin' } });

      const response = await request(app.getHttpServer() as Server)
        .delete(`/api/roles/${adminRole!.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(409);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('ROLE_PROTECTED');
    });
  });

  describe('GET /api/permissions', () => {
    it('returns paginated permissions for admin', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedResponse<{ id: string; key: string; name: string }>;
      expect(body.data).toBeDefined();
      expect(body.meta.total).toBeGreaterThanOrEqual(7);
      expect(body.data[0].key).toBeDefined();
    });
  });
});
