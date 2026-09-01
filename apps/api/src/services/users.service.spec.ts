import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../db/prisma.service';

describe('UsersService', () => {
  function buildService(prismaMock: Partial<PrismaService>): UsersService {
    return new UsersService(prismaMock as PrismaService);
  }

  it('doner_kendi_email_kullanici_adi_rolunu_seviyesini_xpsini_ve_susturma_durumunu', async () => {
    const mutedUntil = new Date('2026-01-01');
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'test@koqep.local',
          username: 'test',
          role: 'user',
          level: 2,
          totalXp: 87,
          mutedUntil,
        }),
      } as unknown as PrismaService['user'],
    };

    const service = buildService(prismaMock);

    await expect(service.getProfile('user-1')).resolves.toEqual({
      email: 'test@koqep.local',
      username: 'test',
      role: 'user',
      level: 2,
      totalXp: 87,
      mutedUntil,
    });
  });

  it('reddeder_var_olmayan_kullaniciyi', async () => {
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      } as unknown as PrismaService['user'],
    };

    const service = buildService(prismaMock);

    await expect(service.getProfile('yok')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  // M10 Faz 2 Slice D+E: başkasının profili - public-safe alan seti.
  it('getPublicProfile_sadece_public_alanlari_doner', async () => {
    const createdAt = new Date('2026-01-01');
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          username: 'baskasi',
          createdAt,
          level: 3,
          totalXp: 150,
        }),
      } as unknown as PrismaService['user'],
    };

    const service = buildService(prismaMock);

    await expect(service.getPublicProfile('baskasi')).resolves.toEqual({
      username: 'baskasi',
      createdAt,
      level: 3,
      totalXp: 150,
      xpProgressPercent: (10 / 35) * 100, // 150 % 35 = 10
    });
  });

  // M13 Slice E: XP_PER_LEVEL frontend'e hiç açılmıyor - yüzde burada
  // hesaplanıp gönderiliyor, tam kata denk gelen bir totalXp (bir sonraki
  // seviyeye YENİ geçmiş) %0 dönmeli.
  it('getPublicProfile_xpProgressPercent_tam_seviye_katinda_sifir_doner', async () => {
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          username: 'tazekullanici',
          createdAt: new Date('2026-01-01'),
          level: 2,
          totalXp: 70, // 2 * 35, tam kat
        }),
      } as unknown as PrismaService['user'],
    };

    const service = buildService(prismaMock);

    await expect(
      service.getPublicProfile('tazekullanici'),
    ).resolves.toMatchObject({
      xpProgressPercent: 0,
    });
  });

  it('getPublicProfile_reddeder_var_olmayan_kullanici_adini', async () => {
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      } as unknown as PrismaService['user'],
    };

    const service = buildService(prismaMock);

    await expect(service.getPublicProfile('yok')).rejects.toThrow(
      NotFoundException,
    );
  });
});
