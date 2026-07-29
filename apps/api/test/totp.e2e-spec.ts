import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { Secret, TOTP } from 'otpauth';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

describe('TOTP setup/enable/login/disable (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function signUpFreshUser(): Promise<{
    email: string;
    password: string;
    accessToken: string;
  }> {
    const issuer = await prisma.user.create({
      data: {
        email: `issuer-${randomUUID()}@koqep.local`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    const code = `INVITE-${randomUUID()}`;
    await prisma.invite.create({ data: { code, issuedById: issuer.id } });

    const email = `user-${randomUUID()}@koqep.local`;
    const password = 'a-strong-password';
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, password })
      .expect(201);

    const body = response.body as { accessToken: string };
    return { email, password, accessToken: body.accessToken };
  }

  it('tam_akis_kurulum_etkinlestirme_giris_ve_kapatma', async () => {
    const { email, password, accessToken } = await signUpFreshUser();
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
