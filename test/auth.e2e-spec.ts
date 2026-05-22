import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Logger, LoggerErrorInterceptor } from 'nestjs-pino';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import type { Server } from 'http';
import { AppModule } from '@/app.module';
import { AppExceptionFilter } from '@/common/filters/app-exception.filter';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { hash } from 'bcryptjs';
import { createHash } from 'crypto';

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
    isVerified: boolean;
    createdAt: string;
  };
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mockEmailService: {
    sendVerificationEmail: jest.Mock;
    sendPasswordResetEmail: jest.Mock;
  };

  beforeAll(async () => {
    mockEmailService = {
      sendVerificationEmail: jest.fn(),
      sendPasswordResetEmail: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(mockEmailService)
      .compile();

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

  afterEach(async () => {
    await prisma.session.deleteMany();
    await prisma.verificationToken.deleteMany();
    await prisma.user.deleteMany();
    mockEmailService.sendVerificationEmail.mockClear();
    mockEmailService.sendPasswordResetEmail.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('creates a new user and returns 201', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      expect(response.body).toEqual({
        message: 'Registration successful. Please verify your email.',
      });

      const user = await prisma.user.findUnique({
        where: { email: 'user@example.com' },
      });
      expect(user).toBeTruthy();
      expect(user!.email).toBe('user@example.com');
      expect(user!.isVerified).toBe(false);
      expect(user!.password).not.toBe('password123');

      const verificationToken = await prisma.verificationToken.findFirst({
        where: { user: { email: 'user@example.com' } },
      });
      expect(verificationToken).toBeTruthy();
      expect(verificationToken!.type).toBe('EMAIL_VERIFICATION');

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      const emailCall = mockEmailService.sendVerificationEmail.mock.calls[0] as [string, string];
      expect(emailCall[0]).toBe('user@example.com');
      expect(emailCall[1]).toMatch(/^[a-f0-9]{128}$/);
    });

    it('returns 409 when email already exists', async () => {
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: 'hashed',
          isVerified: false,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'User with this email already exists',
        code: 'USER_ALREADY_EXISTS',
      });
    });

    it('returns 400 for invalid email', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'password123' })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.statusCode).toBe(400);
    });

    it('returns 400 for password too short', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'short' })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.statusCode).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 with access token and refresh cookie for verified user', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      const body = response.body as LoginResponse;
      expect(body.accessToken).toBeDefined();
      expect(body.user).toEqual({
        id: expect.any(String) as string,
        email: 'user@example.com',
        isVerified: true,
        createdAt: expect.any(String) as string,
      });

      const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      expect(cookies!.some((c) => c.includes('refresh_token'))).toBe(true);

      const session = await prisma.session.findFirst({
        where: { user: { email: 'user@example.com' } },
      });
      expect(session).toBeTruthy();
    });

    it('returns 401 for wrong password', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'wrongpassword' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('returns 401 for non-existent user', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('returns 403 for unverified user', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: false,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(403);

      expect(response.body).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Email not verified',
        code: 'EMAIL_NOT_VERIFIED',
      });
    });

    it('returns 401 for inactive user', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
          isActive: false,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    });

    it('normalizes email to lowercase', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'User@Example.COM', password: 'password123' })
        .expect(200);

      const body = response.body as LoginResponse;
      expect(body.accessToken).toBeDefined();
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('returns 200 with new access token and rotated refresh cookie', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
      const oldSessionCount = await prisma.session.count();
      expect(oldSessionCount).toBe(1);

      const refreshResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);

      const refreshBody = refreshResponse.body as { accessToken: string };
      expect(refreshBody.accessToken).toBeDefined();
      expect(typeof refreshBody.accessToken).toBe('string');

      const newCookies = refreshResponse.headers['set-cookie'] as unknown as string[];
      expect(newCookies).toBeDefined();
      expect(newCookies.some((c) => c.includes('refresh_token'))).toBe(true);

      const newSessionCount = await prisma.session.count();
      expect(newSessionCount).toBe(1);
    });

    it('returns 401 when cookie is missing', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/refresh')
        .expect(401);

      expect(response.body).toEqual({
        statusCode: 401,
        error: 'Unauthorized',
        message: 'Invalid or expired refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    });

    it('returns 401 when refresh token is reused', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as unknown as string[];

      // First refresh succeeds
      const refreshResponse1 = await request(app.getHttpServer() as Server)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .expect(200);

      const refreshBody1 = refreshResponse1.body as { accessToken: string };
      expect(refreshBody1.accessToken).toBeDefined();

      // Reuse the same old cookie — should fail
      const refreshResponse2 = await request(app.getHttpServer() as Server)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .expect(401);

      const refreshBody2 = refreshResponse2.body as ApiErrorResponse;
      expect(refreshBody2.code).toBe('INVALID_REFRESH_TOKEN');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('returns 204 and clears cookie for authenticated user', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as unknown as string[];

      const logoutResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/logout')
        .set('Cookie', cookies)
        .expect(204);

      expect(logoutResponse.body).toEqual({});

      const clearedCookies = logoutResponse.headers['set-cookie'] as unknown as string[] | undefined;
      expect(clearedCookies).toBeDefined();
      expect(clearedCookies!.some((c) => c.includes('refresh_token='))).toBe(true);

      const sessionCount = await prisma.session.count();
      expect(sessionCount).toBe(0);
    });

    it('returns 204 when no cookie is present', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/logout')
        .expect(204);

      expect(response.body).toEqual({});
    });
  });

  describe('POST /api/auth/verify-email', () => {
    it('verifies email and allows login', async () => {
      const registerResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      expect(registerResponse.body).toEqual({
        message: 'Registration successful. Please verify your email.',
      });

      const emailCall = mockEmailService.sendVerificationEmail.mock.calls[0] as [string, string];
      const rawToken = emailCall[1];

      const verifyResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: rawToken })
        .expect(200);

      expect(verifyResponse.body).toEqual({
        message: 'Email verified successfully',
      });

      const user = await prisma.user.findUnique({
        where: { email: 'user@example.com' },
      });
      expect(user!.isVerified).toBe(true);

      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      const loginBody = loginResponse.body as LoginResponse;
      expect(loginBody.user.isVerified).toBe(true);
    });

    it('returns 400 for invalid token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-token' })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    });

    it('returns 400 when token is reused', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      const emailCall = mockEmailService.sendVerificationEmail.mock.calls[0] as [string, string];
      const rawToken = emailCall[1];

      await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: rawToken })
        .expect(200);

      const reuseResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: rawToken })
        .expect(400);

      expect(reuseResponse.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    });

    it('returns 400 when token is expired', async () => {
      const rawToken = 'test-token-123';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: 'hashed',
          isVerified: false,
        },
      });

      await prisma.verificationToken.create({
        data: {
          user: { connect: { email: 'user@example.com' } },
          type: 'EMAIL_VERIFICATION',
          tokenHash,
          expiresAt: new Date(Date.now() - 86_400_000),
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: rawToken })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });

      const tokenCount = await prisma.verificationToken.count();
      expect(tokenCount).toBe(1);
    });

    it('returns 409 when email is already verified', async () => {
      const rawToken = 'test-token-123';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: 'hashed',
          isVerified: true,
        },
      });

      await prisma.verificationToken.create({
        data: {
          user: { connect: { email: 'user@example.com' } },
          type: 'EMAIL_VERIFICATION',
          tokenHash,
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: rawToken })
        .expect(409);

      expect(response.body).toEqual({
        statusCode: 409,
        error: 'Conflict',
        message: 'Email is already verified',
        code: 'EMAIL_ALREADY_VERIFIED',
      });
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    it('sends a new verification email for unverified user', async () => {
      await request(app.getHttpServer() as Server)
        .post('/api/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201);

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      const firstEmailCall = mockEmailService.sendVerificationEmail.mock.calls[0] as [string, string];
      const firstToken = firstEmailCall[1];

      const resendResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/resend-verification')
        .send({ email: 'user@example.com' })
        .expect(200);

      expect(resendResponse.body).toEqual({
        message: 'If an account with that email exists, we sent a verification link.',
      });

      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(2);
      const secondEmailCall = mockEmailService.sendVerificationEmail.mock.calls[1] as [string, string];
      const secondToken = secondEmailCall[1];

      expect(firstToken).not.toBe(secondToken);

      // Old token should not work anymore
      const oldVerifyResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: firstToken })
        .expect(400);

      const oldVerifyBody = oldVerifyResponse.body as ApiErrorResponse;
      expect(oldVerifyBody.code).toBe('INVALID_TOKEN');

      // New token should work
      const newVerifyResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/verify-email')
        .send({ token: secondToken })
        .expect(200);

      const newVerifyBody = newVerifyResponse.body as { message: string };
      expect(newVerifyBody.message).toBe('Email verified successfully');
    });

    it('returns 200 even when email does not exist', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'If an account with that email exists, we sent a verification link.',
      });

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });

    it('returns 200 when user is already verified', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/resend-verification')
        .send({ email: 'user@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'If an account with that email exists, we sent a verification link.',
      });

      expect(mockEmailService.sendVerificationEmail).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns 200 and creates a password reset token', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'If an account with that email exists, we sent a reset link.',
      });

      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      const emailCall = mockEmailService.sendPasswordResetEmail.mock.calls[0] as [string, string];
      expect(emailCall[0]).toBe('user@example.com');
      expect(emailCall[1]).toMatch(/^[a-f0-9]{128}$/);

      const resetToken = await prisma.verificationToken.findFirst({
        where: { user: { email: 'user@example.com' }, type: 'PASSWORD_RESET' },
      });
      expect(resetToken).toBeTruthy();
    });

    it('returns 200 even when email does not exist', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' })
        .expect(200);

      expect(response.body).toEqual({
        message: 'If an account with that email exists, we sent a reset link.',
      });

      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('replaces existing reset tokens when requesting again', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      await request(app.getHttpServer() as Server)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(200);

      const firstEmailCall = mockEmailService.sendPasswordResetEmail.mock.calls[0] as [string, string];
      const firstToken = firstEmailCall[1];

      await request(app.getHttpServer() as Server)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(200);

      const secondEmailCall = mockEmailService.sendPasswordResetEmail.mock.calls[1] as [string, string];
      const secondToken = secondEmailCall[1];

      expect(firstToken).not.toBe(secondToken);

      const tokenCount = await prisma.verificationToken.count({
        where: { user: { email: 'user@example.com' }, type: 'PASSWORD_RESET' },
      });
      expect(tokenCount).toBe(1);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('resets password and invalidates sessions', async () => {
      const hashedPassword = await hash('password123', 12);
      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: hashedPassword,
          isVerified: true,
        },
      });

      const forgotResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/forgot-password')
        .send({ email: 'user@example.com' })
        .expect(200);

      const forgotBody = forgotResponse.body as { message: string };
      expect(forgotBody.message).toBe('If an account with that email exists, we sent a reset link.');

      const emailCall = mockEmailService.sendPasswordResetEmail.mock.calls[0] as [string, string];
      const rawToken = emailCall[1];

      // Login to create a session
      const loginResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(200);

      const cookies = loginResponse.headers['set-cookie'] as unknown as string[];
      const sessionCountBefore = await prisma.session.count();
      expect(sessionCountBefore).toBe(1);

      // Reset password
      const resetResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword123' })
        .expect(200);

      expect(resetResponse.body).toEqual({
        message: 'Password has been reset successfully',
      });

      // Old session should be gone
      const sessionCountAfter = await prisma.session.count();
      expect(sessionCountAfter).toBe(0);

      // Old password should not work
      const oldLoginResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(401);

      const oldLoginBody = oldLoginResponse.body as ApiErrorResponse;
      expect(oldLoginBody.code).toBe('INVALID_CREDENTIALS');

      // New password should work
      const newLoginResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/login')
        .send({ email: 'user@example.com', password: 'newpassword123' })
        .expect(200);

      const newLoginBody = newLoginResponse.body as LoginResponse;
      expect(newLoginBody.accessToken).toBeDefined();

      // Old refresh cookie should not work
      const refreshResponse = await request(app.getHttpServer() as Server)
        .post('/api/auth/refresh')
        .set('Cookie', cookies)
        .expect(401);

      const refreshBody = refreshResponse.body as ApiErrorResponse;
      expect(refreshBody.code).toBe('INVALID_REFRESH_TOKEN');
    });

    it('returns 400 for invalid token', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'newpassword123' })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Invalid or expired token',
        code: 'INVALID_TOKEN',
      });
    });

    it('returns 400 when token is expired', async () => {
      const rawToken = 'test-token-123';
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      await prisma.user.create({
        data: {
          email: 'user@example.com',
          password: 'hashed',
          isVerified: true,
        },
      });

      await prisma.verificationToken.create({
        data: {
          user: { connect: { email: 'user@example.com' } },
          type: 'PASSWORD_RESET',
          tokenHash,
          expiresAt: new Date(Date.now() - 86_400_000),
        },
      });

      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/reset-password')
        .send({ token: rawToken, newPassword: 'newpassword123' })
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Token has expired',
        code: 'TOKEN_EXPIRED',
      });
    });

    it('returns 400 for weak password', async () => {
      const response = await request(app.getHttpServer() as Server)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token', newPassword: 'short' })
        .expect(400);

      const body = response.body as ApiErrorResponse;
      expect(body.statusCode).toBe(400);
    });
  });
});
