import { UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../db/prisma.service';

describe('UsersService', () => {
  function buildService(prismaMock: Partial<PrismaService>): UsersService {
    return new UsersService(prismaMock as PrismaService);
  }

  it('doner_kendi_email_kullanici_adi_rolunu_seviyesini_ve_xpsini', async () => {
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          email: 'test@koqep.local',
          username: 'test',
          role: 'user',
          level: 2,
          totalXp: 87,
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
});
