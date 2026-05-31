import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '@/prisma/prisma.service';
import { UnauthorizedException } from '@/common/exceptions';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: DeepMockProxy<PrismaService>;

  beforeEach(async () => {
    prisma = mockDeep<PrismaService>();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    strategy = module.get(JwtStrategy);
  });

  describe('validate', () => {
    const payload = {
      sub: 'user-id-1',
      roleId: 'role-id-1',
      sid: 'session-id-1',
      permissions: ['users:read'],
    };

    it('returns user context when user exists and is active', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        isActive: true,
        roleId: 'role-id-1',
      } as never);

      const result = await strategy.validate(payload);

      expect(result).toEqual({
        userId: 'user-id-1',
        roleId: 'role-id-1',
        sessionId: 'session-id-1',
        permissions: ['users:read'],
      });
    });

    it('throws UnauthorizedException when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when user is inactive', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-id-1',
        isActive: false,
        roleId: 'role-id-1',
      } as never);

      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
