import { TrafficLogService } from './traffic-log.service';
import { PrismaService } from '../db/prisma.service';

describe('TrafficLogService', () => {
  function buildService(prismaMock: Partial<PrismaService>): TrafficLogService {
    return new TrafficLogService(prismaMock as PrismaService);
  }

  describe('purgeOldRows', () => {
    it('18_ay_onceki_kesim_tarihini_takvim_ayiyla_hesaplar', async () => {
      const now = new Date('2026-08-25T00:00:00.000Z');
      const deleteManyMock = jest.fn().mockResolvedValue({ count: 12 });
      const prismaMock: Partial<PrismaService> = {
        trafficLog: {
          deleteMany: deleteManyMock,
        } as unknown as PrismaService['trafficLog'],
      };

      const service = buildService(prismaMock);
      const result = await service.purgeOldRows(now);

      expect(deleteManyMock).toHaveBeenCalledWith({
        where: { createdAt: { lt: new Date('2025-02-25T00:00:00.000Z') } },
      });
      expect(result).toEqual({ deletedCount: 12 });
    });

    // JS Date.setMonth ayın son gününü hedef ayda TAŞIRIR (Şubat 2025 28
    // gün, "31 Şubat" yok) - kesim tarihi bir kaç gün İLERİ kayar, yani
    // sınırda satırlar bir süre daha FAZLA saklanır, ERKEN silinmez. Bu,
    // 5651'in "en az 18 ay" yükümlülüğü için GÜVENLİ yön - bilerek
    // düzeltilmiyor (ekstra tarih-normalleştirme mantığı gerektirirdi).
    it('ay-sonu_tasmasinda_kesim_tarihi_ileri_kayar_erken_silmez', async () => {
      const now = new Date('2026-08-31T00:00:00.000Z');
      const deleteManyMock = jest.fn().mockResolvedValue({ count: 0 });
      const prismaMock: Partial<PrismaService> = {
        trafficLog: {
          deleteMany: deleteManyMock,
        } as unknown as PrismaService['trafficLog'],
      };

      const service = buildService(prismaMock);
      await service.purgeOldRows(now);

      const [[{ where }]] = deleteManyMock.mock.calls as [
        [{ where: { createdAt: { lt: Date } } }],
      ];
      // "31 Şubat 2025" yok - JS 3 Mart 2025'e taşıyor, 28 Şubat'a DEĞİL.
      expect(where.createdAt.lt.toISOString()).toBe('2025-03-03T00:00:00.000Z');
    });

    it('now_verilmezse_gercek_saati_kullanir', async () => {
      let capturedCutoff: Date | undefined;
      const deleteManyMock = jest
        .fn()
        .mockImplementation((args: { where: { createdAt: { lt: Date } } }) => {
          capturedCutoff = args.where.createdAt.lt;
          return Promise.resolve({ count: 0 });
        });
      const prismaMock: Partial<PrismaService> = {
        trafficLog: {
          deleteMany: deleteManyMock,
        } as unknown as PrismaService['trafficLog'],
      };

      function eighteenMonthsAgo(date: Date): number {
        const cutoff = new Date(date);
        cutoff.setMonth(cutoff.getMonth() - 18);
        return cutoff.getTime();
      }

      const service = buildService(prismaMock);
      const before = eighteenMonthsAgo(new Date());
      await service.purgeOldRows();
      const after = eighteenMonthsAgo(new Date());

      expect(capturedCutoff).toBeDefined();
      expect(capturedCutoff!.getTime()).toBeGreaterThanOrEqual(before);
      expect(capturedCutoff!.getTime()).toBeLessThanOrEqual(after);
    });
  });
});
