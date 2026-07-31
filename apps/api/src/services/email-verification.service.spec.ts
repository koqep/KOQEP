import { EmailVerificationService } from './email-verification.service';
import { PrismaService } from '../db/prisma.service';

describe('EmailVerificationService', () => {
  function buildService(
    prismaMock: Partial<PrismaService>,
  ): EmailVerificationService {
    return new EmailVerificationService(prismaMock as PrismaService);
  }

  describe('createVerificationToken', () => {
    it('hash_ve_son_kullanma_tarihiyle_saklar_ham_tokeni_dondurur', async () => {
      const createSpy = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        emailVerificationToken: {
          create: createSpy,
        } as unknown as PrismaService['emailVerificationToken'],
      };

      const service = buildService(prismaMock);
      const rawToken = await service.createVerificationToken('user-1');

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
