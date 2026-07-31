import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { Secret, TOTP } from 'otpauth';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

describe('TOTP setup/enable/login/disable (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Bu dosya signup/e-posta doğrulama akışını değil TOTP'yi test ediyor -
  // doğrulanmış bir kullanıcıyı doğrudan oluşturup token imzalıyoruz
  // (M2.5 Slice B). Şifre gerçek argon2 hash'i olmalı çünkü test daha
  // sonra gerçek /auth/login çağrıları yapıyor.
  async function createTestUser(): Promise<{
    email: string;
    password: string;
    accessToken: string;
  }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const password = 'a-strong-password';
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { email, password, accessToken };
  }

  it('tam_akis_kurulum_etkinlestirme_giris_ve_kapatma', async () => {
    const { email, password, accessToken } = await createTestUser();
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const setupResponse = await request(app.getHttpServer())
      .post('/auth/totp/setup')
      .set(authHeader)
      .expect(201);
    const { secret } = setupResponse.body as {
      secret: string;
      otpauthUrl: string;
    };
    const totp = new TOTP({ secret: Secret.fromBase32(secret) });

    await request(app.getHttpServer())
      .post('/auth/totp/enable')
      .set(authHeader)
      .send({ totpCode: '000000' })
      .expect(401);

    const enableResponse = await request(app.getHttpServer())
      .post('/auth/totp/enable')
      .set(authHeader)
      .send({ totpCode: totp.generate() })
      .expect(201);
    const recoveryCodes = enableResponse.body as string[];
    expect(recoveryCodes).toHaveLength(8);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, totpCode: totp.generate() })
      .expect(201);

    const usedRecoveryCode = recoveryCodes[0];
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, totpCode: usedRecoveryCode })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password, totpCode: usedRecoveryCode })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/totp/disable')
      .set(authHeader)
      .send({ totpCode: totp.generate() })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
  });
});
