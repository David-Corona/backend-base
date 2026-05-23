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
    name: string | null;
    isActive: boolean;
    isVerified: boolean;
    role: {
      id: string;
      name: string;
    };
    createdAt: string;
  };
}

interface UserResponse {
  id: string;
  email: string;
  name: string | null;
  isActive: boolean;
  isVerified: boolean;
  role: {
    id: string;
    name: string;
  };
  createdAt: string;
}

interface PaginatedUsersResponse {
  data: UserResponse[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminId: string;
  let userToken: string;
  let userId: string;

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
  });

  beforeEach(async () => {
    // Create admin user
    const adminRole = await prisma.role.findUnique({
      where: { name: 'admin' },
    });
    const userRole = await prisma.role.findUnique({
      where: { name: 'user' },
    });

    const adminPassword = await hash('adminpass123', 12);
    const admin = await prisma.user.create({
      data: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: adminPassword,
        isVerified: true,
        roleId: adminRole!.id,
      },
    });
    adminId = admin.id;

    const userPassword = await hash('userpass123', 12);
    const user = await prisma.user.create({
      data: {
        email: 'user@example.com',
        name: 'Regular User',
        password: userPassword,
        isVerified: true,
        roleId: userRole!.id,
      },
    });
    userId = user.id;

    // Login as admin
    const adminLogin = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: 'adminpass123' })
      .expect(200);
    adminToken = (adminLogin.body as LoginResponse).accessToken;

    // Login as user
    const userLogin = await request(app.getHttpServer() as Server)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: 'userpass123' })
      .expect(200);
    userToken = (userLogin.body as LoginResponse).accessToken;
  });

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.verificationToken.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/users', () => {
    it('returns paginated list of users for admin', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedUsersResponse;
      expect(body.data).toHaveLength(2);
      expect(body.meta).toEqual({
        total: 2,
        page: 1,
        limit: 25,
        totalPages: 1,
      });
      expect(body.data[0]).toMatchObject({
        id: expect.any(String) as string,
        email: expect.any(String) as string,
        name: expect.any(String) as string,
        isActive: true,
        isVerified: true,
        role: {
          id: expect.any(String) as string,
          name: expect.any(String) as string,
        },
        createdAt: expect.any(String) as string,
      });
    });

    it('returns 403 for non-admin user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users')
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('UNAUTHENTICATED');
    });

    it('respects custom pagination params', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users?page=1&limit=1')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedUsersResponse;
      expect(body.data).toHaveLength(1);
      expect(body.meta.page).toBe(1);
      expect(body.meta.limit).toBe(1);
      expect(body.meta.totalPages).toBe(2);
    });
  });

  describe('GET /api/users/:id', () => {
    it('returns a single user for admin', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as UserResponse;
      expect(body).toMatchObject({
        id: userId,
        email: 'user@example.com',
        name: 'Regular User',
        isActive: true,
        isVerified: true,
        role: {
          id: expect.any(String) as string,
          name: 'user',
        },
      });
    });

    it('returns 403 for non-admin user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('POST /api/users', () => {
    it('creates a new user for admin', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'newuser@example.com',
          password: 'newpass123',
          name: 'New User',
        })
        .expect(201);

      const body = response.body as UserResponse;
      expect(body).toMatchObject({
        email: 'newuser@example.com',
        name: 'New User',
        isActive: true,
        isVerified: true,
        role: {
          name: 'user',
        },
      });
    });

    it('returns 403 for non-admin user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/users')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          email: 'newuser@example.com',
          password: 'newpass123',
        })
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 409 for duplicate email', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'user@example.com',
          password: 'newpass123',
        })
        .expect(409);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('USER_ALREADY_EXISTS');
    });

    it('returns 400 for invalid email', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'not-an-email',
          password: 'newpass123',
        })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for short password', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'new@example.com',
          password: 'short',
        })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('updates user name for admin', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      const body = response.body as UserResponse;
      expect(body.name).toBe('Updated Name');
    });

    it('returns 403 for non-admin user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Hacked' })
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch('/api/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'New Name' })
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('USER_NOT_FOUND');
    });

  });

  describe('GET /api/users with status filter', () => {
    it('returns only active users by default', async () => {
      // Deactivate the regular user
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      const response = await request(app.getHttpServer() as Server)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedUsersResponse;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('admin@example.com');
      expect(body.meta.total).toBe(1);
    });

    it('returns only inactive users with status=inactive', async () => {
      // Deactivate the regular user
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      const response = await request(app.getHttpServer() as Server)
        .get('/api/users?status=inactive')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedUsersResponse;
      expect(body.data).toHaveLength(1);
      expect(body.data[0].email).toBe('user@example.com');
      expect(body.meta.total).toBe(1);
    });

    it('returns all users with status=all', async () => {
      // Deactivate the regular user
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      const response = await request(app.getHttpServer() as Server)
        .get('/api/users?status=all')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as PaginatedUsersResponse;
      expect(body.data).toHaveLength(2);
      expect(body.meta.total).toBe(2);
    });

    it('returns 400 for invalid status value', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users?status=invalid')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/users/:id', () => {
    it('deactivates a user for admin', async () => {
      await request(app.getHttpServer() as Server)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify user is deactivated
      const user = await prisma.user.findUnique({
        where: { id: userId },
      });
      expect(user!.isActive).toBe(false);
    });

    it('prevents self-deactivation for admin', async () => {
      const response = await request(app.getHttpServer() as Server)
        .delete(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('CANNOT_DEACTIVATE_SELF');
    });

    it('returns 403 for non-admin user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .delete(`/api/users/${adminId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .delete('/api/users/nonexistent-id')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('USER_NOT_FOUND');
    });

    it('deletes user sessions on deactivation', async () => {
      // Create a session for the user first
      await prisma.session.create({
        data: {
          userId,
          tokenHash: 'test-session-token-hash',
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await request(app.getHttpServer() as Server)
        .delete(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(204);

      // Verify sessions are deleted
      const sessions = await prisma.session.findMany({
        where: { userId },
      });
      expect(sessions).toHaveLength(0);
    });
  });

  describe('PATCH /api/users/:id/activate', () => {
    it('reactivates a deactivated user for admin', async () => {
      // Deactivate user first
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/users/${userId}/activate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const body = response.body as UserResponse;
      expect(body.isActive).toBe(true);
    });

    it('returns 403 for non-admin user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/users/${adminId}/activate`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 404 for non-existent user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch('/api/users/nonexistent-id/activate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('PATCH /api/users/:id/role', () => {
    it('assigns a role for admin', async () => {
      const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
      });

      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: adminRole!.id })
        .expect(200);

      const body = response.body as UserResponse;
      expect(body.role.name).toBe('admin');
    });

    it('returns 403 for non-admin user', async () => {
      const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
      });

      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/users/${adminId}/role`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ roleId: adminRole!.id })
        .expect(403);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('PERMISSION_DENIED');
    });

    it('returns 404 for non-existent role', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch(`/api/users/${userId}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: 'nonexistent-role-id' })
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('ROLE_NOT_FOUND');
    });

    it('returns 404 for non-existent user', async () => {
      const adminRole = await prisma.role.findUnique({
        where: { name: 'admin' },
      });

      const response = await request(app.getHttpServer() as Server)
        .patch('/api/users/nonexistent-id/role')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ roleId: adminRole!.id })
        .expect(404);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('USER_NOT_FOUND');
    });
  });

  describe('GET /api/users/me', () => {
    it('returns own profile for authenticated user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const body = response.body as UserResponse;
      expect(body).toMatchObject({
        id: userId,
        email: 'user@example.com',
        name: 'Regular User',
      });
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .get('/api/users/me')
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('UNAUTHENTICATED');
    });

    it('returns 401 for deactivated user', async () => {
      // Deactivate user
      await prisma.user.update({
        where: { id: userId },
        data: { isActive: false },
      });

      const response = await request(app.getHttpServer() as Server)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('updates own name for authenticated user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ name: 'Updated Name' })
        .expect(200);

      const body = response.body as UserResponse;
      expect(body.name).toBe('Updated Name');
    });

    it('returns 401 without token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch('/api/users/me')
        .send({ name: 'New Name' })
        .expect(401);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('UNAUTHENTICATED');
    });

    it('rejects isActive field on self-service', async () => {
      const response = await request(app.getHttpServer() as Server)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ isActive: false })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.code).toBe('VALIDATION_ERROR');
    });
  });
});