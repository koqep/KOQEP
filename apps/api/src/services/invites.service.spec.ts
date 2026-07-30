import { ConflictException, NotFoundException } from '@nestjs/common';
import { InvitesService } from './invites.service';
import { PrismaService } from '../db/prisma.service';

describe('InvitesService', () => {
  function buildService(prismaMock: Partial<PrismaService>): InvitesService {
    return new InvitesService(prismaMock as PrismaService);
  }

  it('doner_kullanilmamis_daveti', async () => {
    const invite = { id: 'invite-1', code: 'ABC123', usedAt: null };
    const prismaMock: Partial<PrismaService> = {
      invite: {
        findUnique: jest.fn().mockResolvedValue(invite),
      } as unknown as PrismaService['invite'],
    };

    const service = buildService(prismaMock);

    await expect(service.findRedeemableInvite('ABC123')).resolves.toEqual(
      invite,
    );
  });

  it('reddeder_bulunamayan_davet_kodu', async () => {
    const prismaMock: Partial<PrismaService> = {
      invite: {
        findUnique: jest.fn().mockResolvedValue(null),
      } as unknown as PrismaService['invite'],
    };

    const service = buildService(prismaMock);

    await expect(service.findRedeemableInvite('YOK')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('reddeder_kullanilmis_davet_kodu', async () => {
    const invite = {
      id: 'invite-1',
      code: 'ABC123',
      usedAt: new Date(),
    };
    const prismaMock: Partial<PrismaService> = {
      invite: {
        findUnique: jest.fn().mockResolvedValue(invite),
      } as unknown as PrismaService['invite'],
    };

    const service = buildService(prismaMock);

    await expect(service.findRedeemableInvite('ABC123')).rejects.toThrow(
      ConflictException,
    );
  });

  describe('createInvite', () => {
    it('yuksek_entropili_bir_kod_uretir_ve_issuedbyi_dogru_kaydeder', async () => {
      const createMock = jest.fn().mockResolvedValue({});
      const prismaMock: Partial<PrismaService> = {
        invite: {
          create: createMock,
        } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);
      const { code } = await service.createInvite('user-1');

      expect(code).toEqual(expect.any(String));
      expect(code.length).toBeGreaterThanOrEqual(16);
      expect(createMock).toHaveBeenCalledWith({
        data: { code, issuedById: 'user-1' },
      });
    });

    it('her_cagrida_farkli_bir_kod_uretir', async () => {
      const prismaMock: Partial<PrismaService> = {
        invite: {
          create: jest.fn().mockResolvedValue({}),
        } as unknown as PrismaService['invite'],
      };

      const service = buildService(prismaMock);
      const first = await service.createInvite('user-1');
      const second = await service.createInvite('user-1');

      expect(first.code).not.toBe(second.code);
    });
  });
});
