import { PasswordResetService } from './password-reset.service';
import { PrismaService } from '../db/prisma.service';

describe('PasswordResetService', () => {
  function buildService(
    prismaMock: Partial<PrismaService>,
  ): PasswordResetService {
    return new PasswordResetService(prismaMock as PrismaService);
  }

  describe('createResetToken', () => {
    it('hash_ve_son_kullanma_tarihiyle_saklar_ham_tokeni_dondurur', async () => {
      const createSpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        passwordResetToken: {
          create: createSpy,
        } as unknown as PrismaService['passwordResetToken'],
      };

      const service = buildService(prismaMock);
      const rawToken = await service.createResetToken('user-1');

      expect(typeof rawToken).toBe('string');
      expect(rawToken.length).toBeGreaterThan(20);

      const callArgs = (createSpy.mock.calls[0] as unknown[])[0] as {
        data: { userId: string; tokenHash: string; expiresAt: Date };
      };
      expect(callArgs.data.userId).toBe('user-1');
      expect(callArgs.data.tokenHash).not.toBe(rawToken);
      expect(callArgs.data.expiresAt.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
