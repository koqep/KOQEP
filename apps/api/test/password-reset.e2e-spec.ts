import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { EmailService } from './../src/services/email.service';

describe('Password reset request/confirm (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emailServiceMock = {
    sendPasswordResetRequestEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedNotificationEmail: jest
      .fn()
      .mockResolvedValue(undefined),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    emailServiceMock.sendPasswordResetRequestEmail.mockClear();
    emailServiceMock.sendPasswordChangedNotificationEmail.mockClear();
  });

  // Bu dosya signup/e-posta doğrulama akışını değil şifre sıfırlamayı test
  // ediyor - doğrulanmış bir kullanıcıyı doğrudan oluşturup gerçek
  // /auth/login ile gerçek bir refreshToken alıyoruz (M2.5 Slice B).
  // Şifre gerçek argon2 hash'i olmalı çünkü login gerçekten çağrılıyor.
  async function createLoggedInTestUser(): Promise<{
    email: string;
    password: string;
    refreshToken: string;
  }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const password = 'a-strong-password';
    const passwordHash = await argon2.hash(password);
    await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const body = response.body as { refreshToken: string };
    return { email, password, refreshToken: body.refreshToken };
  }

  function extractResetToken(): string {
    const call = emailServiceMock.sendPasswordResetRequestEmail.mock
      .calls[0] as [string, string];
    const resetLink = call[1];
    const token = new URL(resetLink).searchParams.get('token');
    if (!token) {
      throw new Error('e2e test: reset link içinde token bulunamadı.');
    }
    return token;
  }

  it('tam_akis_talep_dogrulama_ve_oturum_iptali', async () => {
    const { email, password, refreshToken } = await createLoggedInTestUser();

    await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .send({ email })
      .expect(201);

    expect(emailServiceMock.sendPasswordResetRequestEmail).toHaveBeenCalledWith(
      email,
      expect.stringContaining('reset-password?token=') as string,
    );
    const token = extractResetToken();

    await request(app.getHttpServer())
      .post('/auth/password-reset/confirm')
      .send({ token: 'wrong-token', newPassword: 'a-new-strong-password' })
      .expect(401);

    const newPassword = 'a-new-strong-password';
    await request(app.getHttpServer())
      .post('/auth/password-reset/confirm')
      .send({ token, newPassword })
      .expect(201);

    expect(
      emailServiceMock.sendPasswordChangedNotificationEmail,
    ).toHaveBeenCalledWith(email);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: newPassword })
      .expect(201);
  });

  it('bulunamayan_e_posta_icin_de_ok_doner_ve_e_posta_gondermez', async () => {
    await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .send({ email: `yok-${randomUUID()}@koqep.local` })
      .expect(201);

    expect(
      emailServiceMock.sendPasswordResetRequestEmail,
    ).not.toHaveBeenCalled();
  });
});
