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
    SMTP_HOST: 'smtp.brevo.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'brevo-account@example.com',
    BREVO_API_KEY: 'brevo-api-key',
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

  it('uses Brevo SMTP with the API key as the password', async () => {
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: 'brevo-account@example.com',
        pass: 'brevo-api-key',
      },
    });
  });

  it('falls back to Brevo defaults and the legacy SMTP password', async () => {
    await createMailService({
      SMTP_HOST: undefined,
      SMTP_PORT: '',
      SMTP_SECURE: undefined,
      SMTP_USER: undefined,
      BREVO_API_KEY: undefined,
      SMTP_PASSWORD: 'legacy-password',
    });

    expect(mockCreateTransport).toHaveBeenLastCalledWith({
      host: 'smtp.brevo.com',
      port: 587,
      secure: false,
      auth: {
        user: 'no-reply@example.com',
        pass: 'legacy-password',
      },
    });
  });
});
