import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { EmailService } from './../src/services/email.service';

describe('Invite issuance + rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  // Bu dosyanın odağı /invites, e-posta gönderimi değil - ama aşağıdaki ilk
  // test gerçek /auth/signup'ı tetikliyor (bkz. üstteki yorum), o da
  // EmailService'e dokunuyor. testing.md'nin "mock'u sadece dış sınırlarda
  // kullan" kuralı gereği Resend'e gerçek bir ağ çağrısı yapılmasın diye
  // mock'landı (auth-signup-login.e2e-spec.ts'deki aynı desen).
  const emailServiceMock = {
    sendPasswordResetRequestEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordChangedNotificationEmail: jest
      .fn()
      .mockResolvedValue(undefined),
    sendEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
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
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Bu dosyanın testleri /invites endpoint'ini test ediyor, signup/e-posta
  // doğrulama akışını değil - sadece kimlik doğrulanmış bir "davetçi"ye
  // ihtiyaç var, doğrudan doğrulanmış kullanıcı oluşturup token imzalıyoruz
  // (M2.5 Slice B). Aşağıdaki ilk testte AYRICA gerçek /auth/signup'a
  // yapılan iç çağrı bilerek dokunulmadan kaldı - "üretilen kod gerçekten
  // signup'ta işe yarıyor mu" iddiasını bizzat kanıtlayan asıl satır o.
  async function createTestUser(): Promise<{
    email: string;
    accessToken: string;
  }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: 'test-not-a-real-hash',
        emailVerifiedAt: new Date(),
      },
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { email, accessToken };
  }

  it('gecerli_bir_davet_kodu_uretir_ve_gercek_signup_ile_kullanilabilir', async () => {
    const issuer = await createTestUser();

    const response = await request(app.getHttpServer())
      .post('/invites')
      .set('Authorization', `Bearer ${issuer.accessToken}`)
      .expect(201);

    const { code } = response.body as { code: string };
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThanOrEqual(16);

    const newUserEmail = `invited-${randomUUID()}@koqep.local`;
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: newUserEmail,
        username: `invited-${randomUUID()}`,
        password: 'a-strong-password',
      })
      .expect(201);
  });

  it('reddeder_kimliksiz_istegi', async () => {
    await request(app.getHttpServer()).post('/invites').expect(401);
  });

  it('saatte_bes_davetten_fazlasini_ayni_kullanici_icin_engeller', async () => {
    const issuer = await createTestUser();
    const authHeader = { Authorization: `Bearer ${issuer.accessToken}` };

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/invites')
        .set(authHeader)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/invites')
      .set(authHeader)
      .expect(429);
  });
});
