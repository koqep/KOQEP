import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../db/prisma.service';
import { DEV_USER_EMAIL } from '../db/dev-seed.constants';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'test-secret' });

  function buildService(prismaMock: Partial<PrismaService>): AuthService {
    return new AuthService(prismaMock as PrismaService, jwt);
  }

  it('doner_gecerli_bir_erisim_tokeni_seed_kullanici_icin', async () => {
    const seededUser = { id: 'user-1', email: DEV_USER_EMAIL };
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue(seededUser),
      } as unknown as PrismaService['user'],
    };

    const service = buildService(prismaMock);
    const { accessToken } = await service.issueDevLoginToken();

    const payload = jwt.verify<{ sub: string; email: string }>(accessToken);
    expect(payload.sub).toBe(seededUser.id);
    expect(payload.email).toBe(seededUser.email);
  });

  it('reddeder_seed_kullanici_bulunamazsa', async () => {
    const prismaMock: Partial<PrismaService> = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
      } as unknown as PrismaService['user'],
    };

    const service = buildService(prismaMock);

    await expect(service.issueDevLoginToken()).rejects.toThrow(
      UnauthorizedException,
    );
  });
});
