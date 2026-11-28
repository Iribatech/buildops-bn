import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockCreateTransport = jest.fn();

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: mockCreateTransport,
  },
}));

const { MailService } = await import('./mail.service.js');

describe('MailService', () => {
  let mailService: InstanceType<typeof MailService>;
  let config: any;
  let mockSendMail: any;

  const values: Record<string, string | undefined> = {
    EMAIL_FROM: 'no-reply@example.com',
    APP_BASE_URL: 'http://localhost:3000',
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '465',
    SMTP_SECURE: 'true',
    SMTP_USER: 'sender@example.com',
    SMTP_PASSWORD: 'app-password',
  };

  async function createMailService(
    overrides: Record<string, string | undefined> = {},
  ) {
    config = {
      get: jest.fn(
        (key: string, fallback?: string) =>
          ({
            ...values,
            ...overrides,
          })[key] ?? fallback,
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: config,
        },
      ],
    }).compile();

    return moduleRef.get(MailService);
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    mockSendMail = jest.fn(async () => ({
      messageId: 'test-message-id',
    }));

    mockCreateTransport.mockReturnValue({
      sendMail: mockSendMail,
    });

    mailService = await createMailService();
  });

  it('sends a verification email via Nodemailer', async () => {
    await mailService.sendVerificationEmail('user@example.com', 'token-abc');

    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const payload = mockSendMail.mock.calls[0][0] as {
      to: string;
      from: string;
      subject: string;
      html: string;
    };

    expect(payload.to).toBe('user@example.com');

    expect(payload.from).toBe('no-reply@example.com');

    expect(payload.subject).toBe('Verify your email');

    expect(payload.html).toContain(
      'http://localhost:3000/api/v1/auth/verify-email?token=token-abc',
    );

    expect(payload.html).toContain('Verify your email');
  });

  it('sends a reset password email via Nodemailer', async () => {
    await mailService.sendResetPasswordEmail('user@example.com', 'token-abc');

    expect(mockSendMail).toHaveBeenCalledTimes(1);

    const payload = mockSendMail.mock.calls[0][0] as {
      to: string;
      subject: string;
      html: string;
    };

    expect(payload.to).toBe('user@example.com');

    expect(payload.subject).toBe('Reset your password');

    expect(payload.html).toContain(
      'http://localhost:3000/api/v1/auth/reset-password?token=token-abc',
    );
  });

  it('throws when Nodemailer fails to send an email', async () => {
    mockSendMail.mockRejectedValue(new Error('SMTP connection failed'));

    await expect(
      mailService.sendVerificationEmail('user@example.com', 'token-abc'),
    ).rejects.toThrow('Failed to send email: SMTP connection failed');
  });

  it('uses the configured SMTP settings', async () => {
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: {
        user: 'sender@example.com',
        pass: 'app-password',
      },
    });
  });

  it('falls back to the SMTP defaults', async () => {
    await createMailService({
      SMTP_HOST: undefined,
      SMTP_PORT: '',
      SMTP_SECURE: undefined,
      SMTP_USER: undefined,
      SMTP_PASSWORD: 'fallback-password',
    });

    expect(mockCreateTransport).toHaveBeenLastCalledWith({
      host: 'localhost',
      port: 465,
      secure: true,
      auth: {
        user: 'no-reply@example.com',
        pass: 'fallback-password',
      },
    });
  });
});
