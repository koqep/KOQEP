import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

const sendMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe('EmailService', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  function buildService(
    configValues: Record<string, string | undefined> = {},
  ): EmailService {
    const configMock = {
      get: jest.fn((key: string) => configValues[key]),
    } as unknown as ConfigService;
    return new EmailService(configMock);
  }

  describe('sendPasswordResetRequestEmail', () => {
    it('dogru_alici_konu_ve_baglantiyla_gonderir', async () => {
      sendMock.mockResolvedValue({ data: { id: 'x' }, error: null });
      const service = buildService();

      await service.sendPasswordResetRequestEmail(
        'a@koqep.local',
        'https://x/reset?token=abc',
      );

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@koqep.local',
          from: 'onboarding@resend.dev',
          subject: expect.stringContaining('sıfırlama') as string,
          html: expect.stringContaining('https://x/reset?token=abc') as string,
        }),
      );
    });

    it('kullanilan_from_adresi_config_uzerinden_gelir', async () => {
      sendMock.mockResolvedValue({ data: { id: 'x' }, error: null });
      const service = buildService({ EMAIL_FROM_ADDRESS: 'noreply@koqep.com' });

      await service.sendPasswordResetRequestEmail('a@koqep.local', 'link');

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'noreply@koqep.com' }),
      );
    });

    it('resend_hata_dondurunce_firlatir', async () => {
      sendMock.mockResolvedValue({
        data: null,
        error: { message: 'bad key', name: 'invalid_api_key' },
      });
      const service = buildService();

      await expect(
        service.sendPasswordResetRequestEmail('a@koqep.local', 'link'),
      ).rejects.toThrow();
    });
  });

  describe('sendPasswordChangedNotificationEmail', () => {
    it('dogru_aliciya_gonderir', async () => {
      sendMock.mockResolvedValue({ data: { id: 'x' }, error: null });
      const service = buildService();

      await service.sendPasswordChangedNotificationEmail('a@koqep.local');

      expect(sendMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'a@koqep.local',
          subject: expect.stringContaining('değiştirildi') as string,
        }),
      );
    });
  });
});
