import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { Resend } from 'resend';

jest.mock('resend', () => {
  return {
    Resend: jest.fn().mockImplementation(() => ({
      emails: {
        send: jest.fn().mockResolvedValue({ id: 'email-id' }),
      },
    })),
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

  beforeEach(async () => {
    mockSend = jest.fn().mockResolvedValue({ id: 'email-id' });
    (Resend as jest.Mock).mockImplementation(() => ({
      emails: { send: mockSend },
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    it('sends verification email with token and expiry', async () => {
      await service.sendVerificationEmail('user@example.com', 'abc123', '24 hours');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0] as [Record<string, unknown>];
      expect(call[0]).toMatchObject({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Verify your email address',
      });
      expect(call[0].html).toContain('abc123');
      expect(call[0].html).toContain('24 hours');
      expect(call[0].html).toContain('Verify your email address');
      expect(call[0].html).not.toContain('{{token}}');
      expect(call[0].html).not.toContain('{{expiresIn}}');
    });

    it('escapes HTML in token to prevent injection', async () => {
      const maliciousToken = '<script>alert("xss")</script>';
      await service.sendVerificationEmail('user@example.com', maliciousToken, '24 hours');
      const call = mockSend.mock.calls[0] as [Record<string, unknown>];
      expect(call[0].html).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
      expect(call[0].html).not.toContain('<script>');
    });

    it('propagates errors from resend', async () => {
      mockSend.mockRejectedValue(new Error('API failure'));

      await expect(
        service.sendVerificationEmail('user@example.com', 'abc123', '24 hours'),
      ).rejects.toThrow('API failure');
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('sends password reset email with token and expiry', async () => {
      await service.sendPasswordResetEmail('user@example.com', 'reset456', '1 hour');

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0] as [Record<string, unknown>];
      expect(call[0]).toMatchObject({
        from: 'noreply@example.com',
        to: 'user@example.com',
        subject: 'Reset your password',
      });
      expect(call[0].html).toContain('reset456');
      expect(call[0].html).toContain('1 hour');
      expect(call[0].html).toContain('Reset your password');
      expect(call[0].html).not.toContain('{{token}}');
      expect(call[0].html).not.toContain('{{expiresIn}}');
    });

    it('propagates errors from resend', async () => {
      mockSend.mockRejectedValue(new Error('API failure'));

      await expect(
        service.sendPasswordResetEmail('user@example.com', 'reset456', '1 hour'),
      ).rejects.toThrow('API failure');
    });
  });
});
