import { MeService } from './me.service';
import { PrismaService } from '../db/prisma.service';

describe('MeService', () => {
  function buildService(prismaMock: Partial<PrismaService>): MeService {
    return new MeService(prismaMock as PrismaService);
  }

  describe('exportUserData', () => {
    it('kullanicinin_kendi_verisini_dogru_alanlarla_dondurur', async () => {
      const user = {
        id: 'user-1',
        email: 'a@koqep.local',
        username: 'a',
        createdAt: new Date('2026-01-01'),
        role: 'member',
        emailVerifiedAt: new Date('2026-01-02'),
        totalXp: 40,
        level: 1,
        termsAcceptedAt: new Date('2026-01-01'),
        passwordHash: 'gizli-hash',
        totpSecret: 'gizli-sifreli-secret',
        inviterId: 'baska-kullanici-id',
      };
      const messages = [
        {
          id: 'msg-1',
          content: 'merhaba',
          createdAt: new Date('2026-01-03'),
          room: { name: 'general' },
        },
      ];
      const invites = [
        {
          code: 'CODE1',
          createdAt: new Date('2026-01-04'),
          usedAt: null,
          revokedAt: null,
          issuedById: 'user-1',
          usedById: 'baska-kullanici-id-2',
        },
      ];
      const reputationEvents = [
        {
          actionType: 'MESSAGE_SENT',
          amount: 1,
          createdAt: new Date('2026-01-03'),
          userId: 'user-1',
        },
      ];
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
        message: {
          findMany: jest.fn().mockResolvedValue(messages),
        } as unknown as PrismaService['message'],
        invite: {
          findMany: jest.fn().mockResolvedValue(invites),
        } as unknown as PrismaService['invite'],
        reputationEvent: {
          findMany: jest.fn().mockResolvedValue(reputationEvents),
        } as unknown as PrismaService['reputationEvent'],
      };

      const service = buildService(prismaMock);
      const result = await service.exportUserData('user-1');

      expect(result).toEqual({
        profile: {
          id: 'user-1',
          email: 'a@koqep.local',
          username: 'a',
          createdAt: user.createdAt,
          role: 'member',
          emailVerifiedAt: user.emailVerifiedAt,
          totalXp: 40,
          level: 1,
          termsAcceptedAt: user.termsAcceptedAt,
        },
        messages: [
          {
            id: 'msg-1',
            content: 'merhaba',
            createdAt: messages[0].createdAt,
            roomName: 'general',
          },
        ],
        invites: [
          {
            code: 'CODE1',
            createdAt: invites[0].createdAt,
            usedAt: null,
            revokedAt: null,
          },
        ],
        reputationEvents: [
          {
            actionType: 'MESSAGE_SENT',
            amount: 1,
            createdAt: reputationEvents[0].createdAt,
          },
        ],
      });

      // Kimlik doğrulama sırları ve başka kullanıcıların kimlikleri
      // yanıtta HİÇ görünmemeli.
      expect(result.profile).not.toHaveProperty('passwordHash');
      expect(result.profile).not.toHaveProperty('totpSecret');
      expect(result.profile).not.toHaveProperty('inviterId');
      expect(result.invites[0]).not.toHaveProperty('usedById');
    });

    it('hic_mesaji_daveti_itibar_olayi_olmayan_kullanici_icin_bos_diziler_doner', async () => {
      const user = {
        id: 'user-2',
        email: 'b@koqep.local',
        username: 'b',
        createdAt: new Date('2026-01-01'),
        role: 'member',
        emailVerifiedAt: null,
        totalXp: 0,
        level: 0,
        termsAcceptedAt: null,
      };
      const prismaMock: Partial<PrismaService> = {
        user: {
          findUniqueOrThrow: jest.fn().mockResolvedValue(user),
        } as unknown as PrismaService['user'],
        message: {
          findMany: jest.fn().mockResolvedValue([]),
        } as unknown as PrismaService['message'],
        invite: {
          findMany: jest.fn().mockResolvedValue([]),
        } as unknown as PrismaService['invite'],
        reputationEvent: {
          findMany: jest.fn().mockResolvedValue([]),
        } as unknown as PrismaService['reputationEvent'],
      };

      const service = buildService(prismaMock);
      const result = await service.exportUserData('user-2');

      expect(result.messages).toEqual([]);
      expect(result.invites).toEqual([]);
      expect(result.reputationEvents).toEqual([]);
      expect(result.profile.id).toBe('user-2');
    });
  });
});
