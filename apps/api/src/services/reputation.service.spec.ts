import { Prisma } from '@prisma/client';
import {
  ReputationService,
  computeLevelFromXp,
  XP_PER_LEVEL,
  MESSAGE_SENT_ACTION,
} from './reputation.service';

describe('computeLevelFromXp', () => {
  it('sifir_xp_seviye_sifir_dondurur', () => {
    expect(computeLevelFromXp(0)).toBe(0);
  });

  it('esigin_tam_altinda_bir_onceki_seviyede_kalir', () => {
    expect(computeLevelFromXp(XP_PER_LEVEL - 1)).toBe(0);
  });

  it('esige_tam_ulasinca_seviye_atlar', () => {
    expect(computeLevelFromXp(XP_PER_LEVEL)).toBe(1);
    expect(computeLevelFromXp(XP_PER_LEVEL * 3)).toBe(3);
  });

  it('replay_ayni_gunlukten_farkli_esikle_farkli_seviye_uretir', () => {
    // Gerçek bir "günlük" - depolanan tek bir toplam DEĞİL, tek tek olay
    // miktarlarının listesi. totalXp buradan türetiliyor (reduce), sonra
    // AYNI totalXp iki farklı eşikle (kural değişikliği simülasyonu)
    // yeniden hesaplanıyor - ADR-0004'ün "günlük yeniden oynatılabilir"
    // iddiasının doğrudan kanıtı.
    const eventAmounts = Array.from({ length: 50 }, () => 1);
    const totalXp = eventAmounts.reduce((sum, amount) => sum + amount, 0);

    const oldRuleLevel = computeLevelFromXp(totalXp, 35);
    const newRuleLevel = computeLevelFromXp(totalXp, 10);

    expect(totalXp).toBe(50);
    expect(oldRuleLevel).toBe(1);
    expect(newRuleLevel).toBe(5);
    expect(newRuleLevel).not.toBe(oldRuleLevel);
  });
});

describe('ReputationService', () => {
  function buildTxMock(existingUser: { totalXp: number; level: number }) {
    const createSpy = jest.fn().mockResolvedValue({});
    const updateSpy = jest
      .fn()
      .mockImplementation(
        (args: {
          data: { totalXp?: { increment: number }; level?: number };
        }) => {
          if (args.data.totalXp) {
            existingUser.totalXp += args.data.totalXp.increment;
          }
          if (args.data.level !== undefined) {
            existingUser.level = args.data.level;
          }
          return Promise.resolve({
            totalXp: existingUser.totalXp,
            level: existingUser.level,
          });
        },
      );
    const tx = {
      reputationEvent: { create: createSpy },
      user: { update: updateSpy },
    } as unknown as Prisma.TransactionClient;
    return { tx, createSpy, updateSpy };
  }

  it('olay_olusturur_ve_totalXpi_artirir_seviye_degismezse_level_guncellemez', async () => {
    const user = { totalXp: 0, level: 0 };
    const { tx, createSpy, updateSpy } = buildTxMock(user);
    const service = new ReputationService();

    const result = await service.awardXp(
      tx,
      'user-1',
      MESSAGE_SENT_ACTION,
      1,
      'msg-1',
    );

    expect(createSpy).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        actionType: MESSAGE_SENT_ACTION,
        amount: 1,
        sourceMessageId: 'msg-1',
      },
    });
    expect(updateSpy).toHaveBeenCalledTimes(1); // sadece totalXp increment, level güncellemesi yok
    expect(result).toEqual({ oldLevel: 0, newLevel: 0 });
  });

  it('esigi_gecince_seviyeyi_gunceller', async () => {
    const user = { totalXp: XP_PER_LEVEL - 1, level: 0 };
    const { tx, updateSpy } = buildTxMock(user);
    const service = new ReputationService();

    const result = await service.awardXp(tx, 'user-1', MESSAGE_SENT_ACTION, 1);

    expect(result).toEqual({ oldLevel: 0, newLevel: 1 });
    expect(updateSpy).toHaveBeenCalledTimes(2); // increment + level güncellemesi
    expect(updateSpy).toHaveBeenLastCalledWith({
      where: { id: 'user-1' },
      data: { level: 1 },
    });
  });

  it('buyuk_bir_miktar_birden_fazla_seviye_atlatabilir', async () => {
    const user = { totalXp: 0, level: 0 };
    const { tx } = buildTxMock(user);
    const service = new ReputationService();

    const result = await service.awardXp(
      tx,
      'user-1',
      'BULK_BACKFILL',
      XP_PER_LEVEL * 3,
    );

    expect(result).toEqual({ oldLevel: 0, newLevel: 3 });
  });
});
