import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from 'nestjs-pino';
import { Prisma } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '@/prisma/prisma.service';
import { EmailService } from '@/modules/email/email.service';
import { UserAlreadyExistsException, InvalidCredentialsException, EmailNotVerifiedException, InvalidRefreshTokenException, InvalidTokenException, TokenExpiredException, AlreadyVerifiedException } from './auth.exceptions';
import { RoleNotFoundException } from '@/modules/roles/roles.exceptions';
import { UserNotFoundException } from '@/common/exceptions';
import { DeepMockProxy, mockDeep } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { createHash } from 'crypto';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: DeepMockProxy<PrismaService>;
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock; getOrThrow: jest.Mock };
  let emailService: { sendVerificationEmail: jest.Mock; sendPasswordResetEmail: jest.Mock };

  beforeEach(async () => {
    jwtService = { sign: jest.fn() };
    configService = { get: jest.fn(), getOrThrow: jest.fn() };
    emailService = { sendVerificationEmail: jest.fn(), sendPasswordResetEmail: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockDeep<PrismaClient>() },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
        { provide: EmailService, useValue: emailService },
        { provide: Logger, useValue: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuthService);
    prisma = module.get(PrismaService);

    prisma.$transaction.mockImplementation(async (callback) => {
      return callback(prisma);
    });

    prisma.role.findUnique.mockResolvedValue({
      id: 'role-1',
      name: 'user',
      description: 'Default user role',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);
  });

  describe('register', () => {
    it('creates a new user with hashed password and sends verification email', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'test-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: false,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'test-id',
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      configService.get.mockReturnValue('24h');
      emailService.sendVerificationEmail.mockResolvedValue(undefined);

      await service.register('test@example.com', 'password123');

      const createCall = prisma.user.create.mock.calls[0];
      const password = (createCall?.[0] as { data: { password: string } }).data.password;
      expect(password).toMatch(/^\$2[aby]\$/);

      expect(prisma.verificationToken.create.mock.calls.length).toBe(1);
      const tokenCall = prisma.verificationToken.create.mock.calls[0];
      expect(
        (tokenCall?.[0] as { data: { userId: string } }).data.userId,
      ).toBe('test-id');

      expect(emailService.sendVerificationEmail.mock.calls.length).toBe(1);
      const emailCall = emailService.sendVerificationEmail.mock.calls[0] as [string, string];
      expect(emailCall[0]).toBe('test@example.com');
      expect(emailCall[1]).toMatch(/^[a-f0-9]{128}$/);
    });

    it('succeeds silently when email send fails', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'test-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: false,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'test-id',
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      configService.get.mockReturnValue('24h');
      emailService.sendVerificationEmail.mockRejectedValue(
        new Error('Resend API error'),
      );

      await expect(
        service.register('test@example.com', 'password123'),
      ).resolves.toBeUndefined();
    });

    it('throws UserAlreadyExistsException on unique constraint violation (legacy meta)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        {
          clientVersion: '7.8.0',
          code: 'P2002',
          meta: { target: ['email'] },
        },
      );
      prisma.user.create.mockRejectedValue(prismaError);

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(UserAlreadyExistsException);
    });

    it('throws UserAlreadyExistsException on unique constraint violation (driver adapter meta)', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`email`)',
        {
          clientVersion: '7.8.0',
          code: 'P2002',
          meta: {
            modelName: 'User',
            driverAdapterError: {
              cause: {
                constraint: {
                  fields: ['email'],
                },
              },
            },
          },
        },
      );
      prisma.user.create.mockRejectedValue(prismaError);

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(UserAlreadyExistsException);
    });

    it('re-throws P2002 on a non-email field', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Unique constraint failed on the fields: (`username`)',
        {
          clientVersion: '7.8.0',
          code: 'P2002',
          meta: { target: ['username'] },
        },
      );
      prisma.user.create.mockRejectedValue(prismaError);

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(prismaError);
    });

    it('re-throws non-P2002 Prisma errors', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Some other error',
        {
          clientVersion: '7.8.0',
          code: 'P9999',
        },
      );
      prisma.user.create.mockRejectedValue(prismaError);

      await expect(
        service.register('test@example.com', 'password123'),
      ).rejects.toThrow(prismaError);
    });
  });

  describe('login', () => {
    it('returns tokens and user for valid verified credentials', async () => {
      const hashedPassword = await hash('password123', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: hashedPassword,
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        role: { id: 'role-1', name: 'user' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);
      jwtService.sign.mockReturnValue('jwt-access-token');
      configService.get.mockReturnValue('7d');
      prisma.session.create.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.login('test@example.com', 'password123');

      expect(result.accessToken).toBe('jwt-access-token');
      expect(result.refreshToken).toMatch(/^[a-f0-9]{128}$/);
      expect(result.user).toEqual({
        id: 'user-id',
        email: 'test@example.com',
        isVerified: true,
        role: { id: 'role-1', name: 'user' },
        createdAt: expect.any(Date) as Date,
      });
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('throws InvalidCredentialsException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('throws InvalidCredentialsException when password is wrong', async () => {
      const hashedPassword = await hash('password123', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: hashedPassword,
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.login('test@example.com', 'wrongpassword'),
      ).rejects.toThrow(InvalidCredentialsException);
    });

    it('throws EmailNotVerifiedException when user is not verified', async () => {
      const hashedPassword = await hash('password123', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: hashedPassword,
        isActive: true,
        isVerified: false,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(EmailNotVerifiedException);
    });

    it('throws InvalidCredentialsException when user is inactive', async () => {
      const hashedPassword = await hash('password123', 12);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: hashedPassword,
        isActive: false,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.login('test@example.com', 'password123'),
      ).rejects.toThrow(InvalidCredentialsException);
    });
  });

  describe('refresh', () => {
    it('returns new tokens and rotates the session', async () => {
      const rawToken = 'a'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.session.delete.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      configService.get.mockReturnValue('7d');
      prisma.session.create.mockResolvedValue({
        id: 'new-session-id',
        userId: 'user-id',
        tokenHash: 'new-hash',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        roleId: 'role-1',
      } as never);
      jwtService.sign.mockReturnValue('new-jwt-access-token');

      const result = await service.refresh(rawToken);

      expect(result.accessToken).toBe('new-jwt-access-token');
      expect(result.refreshToken).toMatch(/^[a-f0-9]{128}$/);
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(prisma.session.delete.mock.calls.length).toBe(1);
      const deleteCall = prisma.session.delete.mock.calls[0];
      expect(deleteCall).toEqual([{ where: { tokenHash } }]);

      expect(prisma.session.create.mock.calls.length).toBe(1);
      const createCall = prisma.session.create.mock.calls[0];
      expect(
        (createCall?.[0] as { data: { userId: string } }).data.userId,
      ).toBe('user-id');
    });

    it('throws InvalidRefreshTokenException when token is undefined', async () => {
      await expect(service.refresh(undefined)).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });

    it('throws InvalidRefreshTokenException when session not found', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to delete does not exist.',
        { clientVersion: '7.8.0', code: 'P2025' },
      );
      prisma.session.delete.mockRejectedValue(prismaError);

      await expect(
        service.refresh('invalid-token'),
      ).rejects.toThrow(InvalidRefreshTokenException);
    });

    it('throws InvalidRefreshTokenException when session is expired', async () => {
      const rawToken = 'b'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.session.delete.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        tokenHash,
        expiresAt: new Date(Date.now() - 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(
        service.refresh(rawToken),
      ).rejects.toThrow(InvalidRefreshTokenException);
    });

    it('throws InvalidRefreshTokenException when token is reused', async () => {
      const rawToken = 'c'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.session.delete.mockResolvedValue({
        id: 'session-id',
        userId: 'user-id',
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      configService.get.mockReturnValue('7d');
      prisma.session.create.mockResolvedValue({
        id: 'new-session-id',
        userId: 'user-id',
        tokenHash: 'new-hash',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        roleId: 'role-1',
      } as never);
      jwtService.sign.mockReturnValue('new-jwt-access-token');

      // First use succeeds
      await service.refresh(rawToken);

      // Second use fails because session was already deleted
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to delete does not exist.',
        { clientVersion: '7.8.0', code: 'P2025' },
      );
      prisma.session.delete.mockRejectedValue(prismaError);

      await expect(service.refresh(rawToken)).rejects.toThrow(
        InvalidRefreshTokenException,
      );
    });
  });

  describe('logout', () => {
    it('deletes the session', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 1 });

      await service.logout('some-token');

      expect(prisma.session.deleteMany.mock.calls.length).toBe(1);
    });

    it('succeeds silently when session does not exist', async () => {
      prisma.session.deleteMany.mockResolvedValue({ count: 0 });

      await expect(service.logout('nonexistent-token')).resolves.toBeUndefined();
    });
  });

  describe('forgotPassword', () => {
    it('finds user, deletes old tokens, creates new one, sends email, returns message', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.verificationToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'PASSWORD_RESET' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      configService.get.mockReturnValue('1h');
      emailService.sendPasswordResetEmail.mockResolvedValue(undefined);

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toBe('If an account with that email exists, we sent a reset link.');
      expect(prisma.user.findUnique.mock.calls.length).toBe(1);
      expect(prisma.verificationToken.deleteMany.mock.calls.length).toBe(1);
      expect(prisma.verificationToken.create.mock.calls.length).toBe(1);
      expect(emailService.sendPasswordResetEmail.mock.calls.length).toBe(1);
      const emailCall = emailService.sendPasswordResetEmail.mock.calls[0] as [string, string];
      expect(emailCall[0]).toBe('test@example.com');
      expect(emailCall[1]).toMatch(/^[a-f0-9]{128}$/);
    });

    it('returns same message when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.forgotPassword('nonexistent@example.com');

      expect(result.message).toBe('If an account with that email exists, we sent a reset link.');
      expect(prisma.verificationToken.deleteMany.mock.calls.length).toBe(0);
      expect(prisma.verificationToken.create.mock.calls.length).toBe(0);
      expect(emailService.sendPasswordResetEmail.mock.calls.length).toBe(0);
    });

    it('succeeds silently when email send fails', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.verificationToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'PASSWORD_RESET' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      configService.get.mockReturnValue('1h');
      emailService.sendPasswordResetEmail.mockRejectedValue(
        new Error('Resend API error'),
      );

      const result = await service.forgotPassword('test@example.com');

      expect(result.message).toBe('If an account with that email exists, we sent a reset link.');
    });
  });

  describe('resetPassword', () => {
    it('updates password, deletes tokens and sessions, returns message', async () => {
      const rawToken = 'a'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.verificationToken.findFirst.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'PASSWORD_RESET' as const,
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'new-hashed',
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.delete.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'PASSWORD_RESET' as const,
        tokenHash,
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.session.deleteMany.mockResolvedValue({ count: 2 });

      const result = await service.resetPassword(rawToken, 'newpassword123');

      expect(result.message).toBe('Password has been reset successfully');
      expect(prisma.user.update.mock.calls.length).toBe(1);
      const updateCall = prisma.user.update.mock.calls[0];
      const newPassword = (updateCall?.[0] as { data: { password: string } }).data.password;
      expect(newPassword).toMatch(/^\$2[aby]\$/);
      expect(prisma.verificationToken.deleteMany.mock.calls.length).toBe(1);
      expect(prisma.session.deleteMany.mock.calls.length).toBe(1);
      const sessionDeleteCall = prisma.session.deleteMany.mock.calls[0];
      expect(
        (sessionDeleteCall?.[0] as { where: { userId: string } }).where.userId,
      ).toBe('user-id');
    });

    it('throws InvalidTokenException when token not found', async () => {
      prisma.verificationToken.findFirst.mockResolvedValue(null);

      await expect(service.resetPassword('invalid-token', 'newpassword123')).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('throws TokenExpiredException when token is expired', async () => {
      const rawToken = 'b'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.verificationToken.findFirst.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'PASSWORD_RESET' as const,
        tokenHash,
        expiresAt: new Date(Date.now() - 86_400_000),
        createdAt: new Date(),
      });

      await expect(service.resetPassword(rawToken, 'newpassword123')).rejects.toThrow(
        TokenExpiredException,
      );
    });
  });

  describe('verifyEmail', () => {
    it('verifies user email and deletes token', async () => {
      const rawToken = 'a'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.verificationToken.findFirst.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: false,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await service.verifyEmail(rawToken);

      expect(result.message).toBe('Email verified successfully');
      expect(prisma.user.update.mock.calls.length).toBe(1);
      const userUpdateCall = prisma.user.update.mock.calls[0];
      expect(
        (userUpdateCall?.[0] as { data: { isVerified: boolean } }).data.isVerified,
      ).toBe(true);
      expect(prisma.verificationToken.deleteMany.mock.calls.length).toBe(1);
    });

    it('throws InvalidTokenException when token not found', async () => {
      prisma.verificationToken.findFirst.mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(
        InvalidTokenException,
      );
    });

    it('throws TokenExpiredException when token is expired', async () => {
      const rawToken = 'b'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.verificationToken.findFirst.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash,
        expiresAt: new Date(Date.now() - 86_400_000),
        createdAt: new Date(),
      });

      await expect(service.verifyEmail(rawToken)).rejects.toThrow(
        TokenExpiredException,
      );
    });

    it('throws AlreadyVerifiedException when user is already verified', async () => {
      const rawToken = 'c'.repeat(128);
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');

      prisma.verificationToken.findFirst.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash,
        expiresAt: new Date(Date.now() + 86_400_000),
        createdAt: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await expect(service.verifyEmail(rawToken)).rejects.toThrow(
        AlreadyVerifiedException,
      );
    });
  });

  describe('resendVerification', () => {
    it('creates a new verification token and sends email for unverified user', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: false,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.verificationToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      configService.get.mockReturnValue('24h');
      emailService.sendVerificationEmail.mockResolvedValue(undefined);

      const result = await service.resendVerification('test@example.com');

      expect(result.message).toBe('If an account with that email exists, we sent a verification link.');
      expect(prisma.verificationToken.deleteMany.mock.calls.length).toBe(1);
      expect(prisma.verificationToken.create.mock.calls.length).toBe(1);
      expect(emailService.sendVerificationEmail.mock.calls.length).toBe(1);
    });

    it('returns same message when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await service.resendVerification('nonexistent@example.com');

      expect(result.message).toBe('If an account with that email exists, we sent a verification link.');
      expect(prisma.verificationToken.deleteMany.mock.calls.length).toBe(0);
      expect(prisma.verificationToken.create.mock.calls.length).toBe(0);
      expect(emailService.sendVerificationEmail.mock.calls.length).toBe(0);
    });

    it('returns same message when user is already verified', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: true,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await service.resendVerification('test@example.com');

      expect(result.message).toBe('If an account with that email exists, we sent a verification link.');
      expect(prisma.verificationToken.deleteMany.mock.calls.length).toBe(0);
      expect(prisma.verificationToken.create.mock.calls.length).toBe(0);
      expect(emailService.sendVerificationEmail.mock.calls.length).toBe(0);
    });

    it('succeeds silently when email send fails', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        password: 'hashed',
        isActive: true,
        isVerified: false,
        roleId: 'role-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      prisma.verificationToken.deleteMany.mockResolvedValue({ count: 0 });
      prisma.verificationToken.create.mockResolvedValue({
        id: 'token-id',
        userId: 'user-id',
        type: 'EMAIL_VERIFICATION' as const,
        tokenHash: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      });
      configService.get.mockReturnValue('24h');
      emailService.sendVerificationEmail.mockRejectedValue(
        new Error('Resend API error'),
      );

      const result = await service.resendVerification('test@example.com');

      expect(result.message).toBe('If an account with that email exists, we sent a verification link.');
    });
  });

  describe('assignRole', () => {
    it('assigns a new role to a user', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: 'admin',
      } as never);
      prisma.user.update.mockResolvedValue({
        id: 'user-id',
        email: 'test@example.com',
        isVerified: true,
        roleId: 'role-admin',
        role: { id: 'role-admin', name: 'admin' },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      const result = await service.assignRole('user-id', 'role-admin');

      expect(result.role.id).toBe('role-admin');
      expect(result.role.name).toBe('admin');
    });

    it('throws RoleNotFoundException when role does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue(null);

      await expect(
        service.assignRole('user-id', 'nonexistent-role'),
      ).rejects.toThrow(RoleNotFoundException);
    });

    it('throws UserNotFoundException when user does not exist', async () => {
      prisma.role.findUnique.mockResolvedValue({
        id: 'role-admin',
        name: 'admin',
      } as never);
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to update does not exist.',
        { clientVersion: '7.8.0', code: 'P2025' },
      );
      prisma.user.update.mockRejectedValue(prismaError);

      await expect(
        service.assignRole('nonexistent-user', 'role-admin'),
      ).rejects.toThrow(UserNotFoundException);
    });
  });
});
