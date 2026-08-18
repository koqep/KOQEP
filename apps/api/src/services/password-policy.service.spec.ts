import { BadRequestException } from '@nestjs/common';
import { PasswordPolicyService } from './password-policy.service';

describe('PasswordPolicyService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe('assertNotBreached', () => {
    it('reddeder_bilinen_sizdirilmis_bir_sifreyi', async () => {
      // sha1('password') = 5baa61e4c9b93f3f0682250b6cf8331b7ee68fd8 -
      // prefix 5BAA6, suffix 1E4C9B93F3F0682250B6CF8331B7EE68FD8.
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () =>
          Promise.resolve(
            '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3730471\nOTHERSUFFIX:1',
          ),
      });
      const service = new PasswordPolicyService();

      await expect(service.assertNotBreached('password')).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.assertNotBreached('password')).rejects.toMatchObject(
        { response: { code: 'PASSWORD_BREACHED' } },
      );
    });

    it('gecer_sizdirilmamis_bir_sifreyi', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:1'),
      });
      const service = new PasswordPolicyService();

      await expect(
        service.assertNotBreached('a-genuinely-unique-password'),
      ).resolves.toBeUndefined();
    });

    it('fail_open_http_hatasinda', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        text: () => Promise.resolve(''),
      });
      const service = new PasswordPolicyService();

      await expect(
        service.assertNotBreached('any-password'),
      ).resolves.toBeUndefined();
    });

    it('fail_open_network_hatasinda', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('network koptu'));
      const service = new PasswordPolicyService();

      await expect(
        service.assertNotBreached('any-password'),
      ).resolves.toBeUndefined();
    });

    it('fail_open_timeout_hatasinda', async () => {
      global.fetch = jest
        .fn()
        .mockRejectedValue(
          new DOMException('The operation was aborted.', 'TimeoutError'),
        );
      const service = new PasswordPolicyService();

      await expect(
        service.assertNotBreached('any-password'),
      ).resolves.toBeUndefined();
    });
  });
});
