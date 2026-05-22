import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { EmailService } from './email.service';
import { Resend } from 'resend';
import * as fs from 'fs';

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ id: 'email-id' }),
      },
    })),
  };
});

jest.mock('fs', () => {
  return {
    readFileSync: jest.fn(),
  };
});

describe('EmailService', () => {
  let service: EmailService;
  let mockSend: jest.Mock;

  const mockConfigService = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'RESEND_API_KEY') return 'test-api-key';
      if (key === 'FROM_EMAIL') return 'noreply@example.com';
      throw new Error(`Unknown key: ${key}`);
    }),
  };

  const mockLogger = {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  };

  beforeEach(async () => {
    mockSend = jest.fn().mockResolvedValue({ id: 'email-id' });
    (Resend as jest.Mock).mockImplementation(() => ({
      emails: { send: mockSend },
    }));

    (fs.readFileSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes('verification-email.hbs')) {
        return '<html><body>Token: {{token}}</body></html>';
      }
      if (path.includes('password-reset-email.hbs')) {
        return '<html><body>Reset: {{token}}</body></html>';
      }
      throw new Error(`Unknown template: ${path}`);
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: Logger, useValue: mockLogger },
      ],
    }).compile();

    service = module.get(EmailService);
    service.onModuleInit();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    it('sends verification email with rendered template', async () => {
      await service.sendVerificationEmail('user@example.com', 'abc123');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0] as [Record<string, unknown>];
      expect(call[0]).toMatchObject({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Verify your email address',
        html: '<html><body>Token: abc123</body></html>',
      });
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email with rendered template', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'reset456');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0] as [Record<string, unknown>];
      expect(call[0]).toMatchObject({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Reset your password',
        html: '<html><body>Reset: reset456</body></html>',
      });
    });
  });
});
