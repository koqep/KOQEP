import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { Secret, TOTP } from 'otpauth';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { EmailService } from './../src/services/email.service';
import { buildEmailServiceMock } from './support/email-service-mock';
import { PasswordPolicyService } from './../src/services/password-policy.service';
import { buildPasswordPolicyServiceMock } from './support/password-policy-mock';

// M7a Slice F: hesap-bazlı brute-force kilidi. EmailService + PasswordPolicyService
// İKİSİ de mock'lanır - bu dosya gerçek /auth/login'i tekrar tekrar çağırıyor,
// kilit e-postası tetiklenince gerçek Resend'e gitmemeli, confirmPasswordReset
// çağrıldığında gerçek HIBP'ye gitmemeli.
describe('Account lockout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emailServiceMock = buildEmailServiceMock();
  const passwordPolicyServiceMock = buildPasswordPolicyServiceMock();
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailServiceMock)
      .overrideProvider(PasswordPolicyService)
      .useValue(passwordPolicyServiceMock)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  beforeEach(() => {
    emailServiceMock.sendAccountLockedNotificationEmail.mockClear();
  });

  async function createTestUser(): Promise<{
    id: string;
    email: string;
    password: string;
  }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const password = 'a-strong-password';
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash, emailVerifiedAt: new Date() },
    });
    createdUserIds.push(user.id);
    return { id: user.id, email, password };
  }

  async function failLoginTimes(email: string, times: number): Promise<void> {
    for (let i = 0; i < times; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong-password' });
    }
  }

  // sendLockoutNotification login()'den await EDİLMİYOR (kullanıcının
  // review'ında bulunan zamanlama-oracle düzeltmesi) - HTTP yanıtı
  // döndükten SONRA tamamlanabilir, bu yüzden DB durumunu kısa bir
  // polling ile bekliyoruz, sabit bir sleep DEĞİL.
  async function waitForLockoutNotifiedAt(userId: string): Promise<void> {
    for (let i = 0; i < 20; i++) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      if (user.lockoutNotifiedAt) return;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  it('bes_art_arda_yanlis_sifre_kilitler_ve_bildirim_gonderir', async () => {
    const user = await createTestUser();

    await failLoginTimes(user.email, 4);
    const fifthAttempt = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: 'wrong-password' })
      .expect(401);

    expect((fifthAttempt.body as { code: string }).code).toBe(
      'INVALID_CREDENTIALS',
    );

    await waitForLockoutNotifiedAt(user.id);
    const locked = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(locked.lockedUntil).not.toBeNull();
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(
      emailServiceMock.sendAccountLockedNotificationEmail,
    ).toHaveBeenCalledWith(user.email);
  });

  it('kilitliyken_dogru_sifreyle_bile_reddeder_bildirimi_tekrar_gondermez', async () => {
    const user = await createTestUser();
    await failLoginTimes(user.email, 5);
    await waitForLockoutNotifiedAt(user.id);
    emailServiceMock.sendAccountLockedNotificationEmail.mockClear();

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(401);

    expect((response.body as { code: string }).code).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(
      emailServiceMock.sendAccountLockedNotificationEmail,
    ).not.toHaveBeenCalled();
  });

  it('kilit_suresi_dolunca_dogru_sifre_giris_yapar_ve_sayaci_sifirlar', async () => {
    const user = await createTestUser();
    await failLoginTimes(user.email, 5);
    await waitForLockoutNotifiedAt(user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: user.password })
      .expect(201);

    const updated = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(updated.failedLoginCount).toBe(0);
    expect(updated.lockedUntil).toBeNull();
  });

  it('soguma_penceresi_icindeyken_ikinci_kilit_bildirim_gondermez', async () => {
    const user = await createTestUser();
    await failLoginTimes(user.email, 5);
    await waitForLockoutNotifiedAt(user.id);
    emailServiceMock.sendAccountLockedNotificationEmail.mockClear();
    // İlk kilit süresi dolmuş AMA lockoutNotifiedAt hâlâ soğuma
    // penceresi içinde (varsayılan: az önce) - yeni bir 5-deneme
    // döngüsü kilitlemeli ama e-posta GÖNDERMEMELİ.
    await prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });

    await failLoginTimes(user.email, 5);

    const locked = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now());
    expect(
      emailServiceMock.sendAccountLockedNotificationEmail,
    ).not.toHaveBeenCalled();
  });

  it('soguma_penceresi_gectikten_sonra_ikinci_kilit_bildirim_gonderir', async () => {
    const user = await createTestUser();
    await failLoginTimes(user.email, 5);
    await waitForLockoutNotifiedAt(user.id);
    emailServiceMock.sendAccountLockedNotificationEmail.mockClear();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        lockedUntil: new Date(Date.now() - 1000),
        lockoutNotifiedAt: new Date(Date.now() - 13 * 60 * 60 * 1000),
      },
    });

    await failLoginTimes(user.email, 5);

    await waitForLockoutNotifiedAt(user.id);
    expect(
      emailServiceMock.sendAccountLockedNotificationEmail,
    ).toHaveBeenCalledWith(user.email);
  });

  it('yanlis_totp_kodu_kilit_sayacini_hic_etkilemez', async () => {
    const user = await createTestUser();
    const authHeader = await (async () => {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: user.email, password: user.password })
        .expect(201);
      return {
        Authorization: `Bearer ${(login.body as { accessToken: string }).accessToken}`,
      };
    })();

    const setupResponse = await request(app.getHttpServer())
      .post('/auth/totp/setup')
      .set(authHeader)
      .expect(201);
    const { secret } = setupResponse.body as { secret: string };
    const totp = new TOTP({ secret: Secret.fromBase32(secret) });
    await request(app.getHttpServer())
      .post('/auth/totp/enable')
      .set(authHeader)
      .send({ totpCode: totp.generate() })
      .expect(201);

    for (let i = 0; i < 6; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: user.email,
          password: user.password,
          totpCode: '000000',
        })
        .expect(401);
    }

    const stillUnlocked = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(stillUnlocked.failedLoginCount).toBe(0);
    expect(stillUnlocked.lockedUntil).toBeNull();
  });

  // Kullanıcının review'ında bulunan gerçek bug: e-posta erişimini
  // kanıtlamak kilit mekanizmasının kendisinden daha güçlü bir doğrulama.
  it('sifre_sifirlama_kilidi_temizler', async () => {
    const user = await createTestUser();
    await failLoginTimes(user.email, 5);
    await waitForLockoutNotifiedAt(user.id);

    await request(app.getHttpServer())
      .post('/auth/password-reset/request')
      .send({ email: user.email })
      .expect(201);
    const resetCall = emailServiceMock.sendPasswordResetRequestEmail.mock
      .calls[0] as [string, string];
    const resetLink = resetCall[1];
    const token = new URL(resetLink).searchParams.get('token');
    if (!token) {
      throw new Error('e2e test: reset link içinde token bulunamadı.');
    }
    const newPassword = 'a-new-strong-password';

    await request(app.getHttpServer())
      .post('/auth/password-reset/confirm')
      .send({ token, newPassword })
      .expect(201);

    const afterReset = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
    });
    expect(afterReset.failedLoginCount).toBe(0);
    expect(afterReset.lockedUntil).toBeNull();

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: user.email, password: newPassword })
      .expect(201);
  });
});
