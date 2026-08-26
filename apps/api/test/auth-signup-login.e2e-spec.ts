import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { EmailService } from './../src/services/email.service';
import { buildEmailServiceMock } from './support/email-service-mock';
import { PasswordPolicyService } from './../src/services/password-policy.service';
import { buildPasswordPolicyServiceMock } from './support/password-policy-mock';

describe('Auth signup/verify-email/login/refresh/logout (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emailServiceMock = buildEmailServiceMock();
  const passwordPolicyServiceMock = buildPasswordPolicyServiceMock();

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
    await app.close();
  });

  beforeEach(() => {
    emailServiceMock.sendEmailVerificationEmail.mockClear();
  });

  async function seedInvite(): Promise<{ code: string; issuerId: string }> {
    const issuer = await prisma.user.create({
      data: {
        email: `issuer-${randomUUID()}@koqep.local`,
        username: `issuer-${randomUUID()}`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    const code = `INVITE-${randomUUID()}`;
    await prisma.invite.create({ data: { code, issuedById: issuer.id } });
    return { code, issuerId: issuer.id };
  }

  function extractVerificationToken(): string {
    const calls = emailServiceMock.sendEmailVerificationEmail.mock.calls as [
      string,
      string,
    ][];
    const verifyLink = calls[calls.length - 1][1];
    const token = new URL(verifyLink).searchParams.get('token');
    if (!token) {
      throw new Error('e2e test: doğrulama bağlantısında token bulunamadı.');
    }
    return token;
  }

  async function signUpVerifyAndLogin(): Promise<{
    email: string;
    password: string;
    accessToken: string;
    refreshToken: string;
    loginResponse: request.Response;
  }> {
    const { code } = await seedInvite();
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const password = 'a-strong-password';

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, username, password })
      .expect(201);

    const token = extractVerificationToken();
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token })
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    const body = loginResponse.body as {
      accessToken: string;
      refreshToken: string;
    };
    return {
      email,
      password,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      loginResponse,
    };
  }

  it('kayit_daveti_talep_eder_dogru_davetciyi_baglar_dogrulama_e_postasi_gonderir', async () => {
    const { code, issuerId } = await seedInvite();
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;

    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email,
        username,
        password: 'a-strong-password',
      })
      .expect(201);

    expect(response.body).toEqual({ ok: true });
    expect(emailServiceMock.sendEmailVerificationEmail).toHaveBeenCalledWith(
      email,
      expect.stringContaining('verify-email?token=') as string,
    );

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(createdUser.inviterId).toBe(issuerId);
    expect(createdUser.emailVerifiedAt).toBeNull();

    const invite = await prisma.invite.findUniqueOrThrow({
      where: { code },
    });
    expect(invite.usedById).toBe(createdUser.id);
  });

  // M7a Slice F: gerçek api.pwnedpasswords.com'a GİTMİYOR - beforeAll'da
  // overrideProvider edilen PasswordPolicyService bir kez breach:true
  // döndürecek şekilde ayarlanıyor (mockRejectedValueOnce, sonraki
  // testleri etkilememesi için).
  it('reddeder_bilinen_sizdirilmis_sifreyi', async () => {
    const { code } = await seedInvite();
    passwordPolicyServiceMock.assertNotBreached.mockRejectedValueOnce(
      new BadRequestException({
        code: 'PASSWORD_BREACHED',
        message:
          'Bu şifre bilinen bir veri sızıntısında bulunmuş, başka bir şifre seç.',
      }),
    );

    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: `user-${randomUUID()}@koqep.local`,
        username: `user-${randomUUID()}`,
        password: 'a-breached-password',
      })
      .expect(400);

    expect((response.body as { code: string }).code).toBe('PASSWORD_BREACHED');
  });

  it('reddeder_tekrar_kullanilan_davet_kodunu', async () => {
    const { code } = await seedInvite();

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: `user-${randomUUID()}@koqep.local`,
        username: `user-${randomUUID()}`,
        password: 'a-strong-password',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: `user-${randomUUID()}@koqep.local`,
        username: `user-${randomUUID()}`,
        password: 'a-strong-password',
      })
      .expect(409);
  });

  it('reddeder_buyuk_kucuk_harf_farkli_ama_ayni_kullanici_adini', async () => {
    const { code: firstCode } = await seedInvite();
    const { code: secondCode } = await seedInvite();
    const takenUsername = `TakenName-${randomUUID()}`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: firstCode,
        email: `user-${randomUUID()}@koqep.local`,
        username: takenUsername,
        password: 'a-strong-password',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: secondCode,
        email: `user-${randomUUID()}@koqep.local`,
        username: takenUsername.toLowerCase(),
        password: 'a-strong-password',
      })
      .expect(409);
  });

  it('dogrulanmadan_giris_engellenir_dogrulaninca_calisir_yanlis_sifre_durumunu_sizdirmaz', async () => {
    const { code } = await seedInvite();
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const password = 'a-strong-password';

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, username, password })
      .expect(201);

    // Doğrulanmadan doğru şifreyle bile giriş engellenir.
    const unverifiedAttempt = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(401);
    expect((unverifiedAttempt.body as { code?: string }).code).toBe(
      'EMAIL_NOT_VERIFIED',
    );

    // Doğrulanmamışken yanlış şifre de aynı şekilde 401 - hangi sebepten
    // reddedildiği (şifre mi, doğrulama mı) sızdırılmıyor, şifre kontrolü
    // doğrulama kontrolünden önce çalışıyor.
    const wrongPasswordAttempt = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    expect((wrongPasswordAttempt.body as { code?: string }).code).toBe(
      'INVALID_CREDENTIALS',
    );

    const token = extractVerificationToken();
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token: 'wrong-token' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/verify-email')
      .send({ token })
      .expect(201);

    // Doğrulandıktan sonra yanlış şifre hâlâ reddedilir.
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);

    // Doğru şifreyle artık gerçekten giriş yapılabiliyor.
    const successResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    const body = successResponse.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');
  });

  it('yeniler_refresh_tokeni_eskisi_grace_penceresinde_bir_kez_daha_calisir', async () => {
    const { refreshToken } = await signUpVerifyAndLogin();

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    const newTokens = refreshResponse.body as { refreshToken: string };
    expect(newTokens.refreshToken).not.toBe(refreshToken);

    // M7a Slice A: eski token ANINDA değil, grace penceresi (10sn) içinde
    // TOLERANS ile bir kez daha kabul ediliyor (çoklu-sekme yarışı) - kesin
    // geçersizleşmenin kanıtı ayrı 'grace_penceresinde...' testinde.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);
  });

  it('cikis_yapinca_refresh_tokeni_gecersiz_kilar', async () => {
    const { refreshToken } = await signUpVerifyAndLogin();

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  // M7a Slice A: çoklu-sekme yarışı - AynI (artık rotasyona uğramış) eski
  // token'ın grace penceresinde BİR KEZ daha kabul edildiğinin, ikinci
  // seferde reddedildiğinin gerçek bir kanıtı (bearer/body yoluyla - grace
  // mantığı AuthService'te, taşıma katmanından bağımsız).
  it('grace_penceresinde_ardisik_iki_refresh_ikisi_de_basarili_ucuncusu_401', async () => {
    const { refreshToken } = await signUpVerifyAndLogin();

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('login_yaniti_refresh_ve_csrf_cookielerini_dogru_bayraklarla_set_eder', async () => {
    const { loginResponse } = await signUpVerifyAndLogin();

    const setCookieHeaders = extractSetCookieHeaders(loginResponse);
    const refreshCookie = findCookie(setCookieHeaders, 'koqep_rt');
    const csrfCookie = findCookie(setCookieHeaders, 'koqep_csrf');

    expect(refreshCookie).toContain('HttpOnly');
    expect(refreshCookie).toContain('Secure');
    expect(refreshCookie).toMatch(/SameSite=None/i);
    expect(refreshCookie).toContain('Path=/auth');

    expect(csrfCookie).not.toContain('HttpOnly');
    expect(csrfCookie).toContain('Secure');
    expect(csrfCookie).toMatch(/SameSite=None/i);
    expect(csrfCookie).toContain('Path=/');
    // path:'/auth' YANLIŞ olurdu - JS'in bu cookie'yi /'dan hiç
    // okuyamaması demekti (kullanıcının review'ında bulunan gerçek bug).
    expect(csrfCookie).not.toContain('Path=/auth');

    // Production regresyonu düzeltmesi (M7a Slice A düzeltmesi): test
    // ortamında WEB_ORIGIN=http://localhost:3000 (ci.yml) - localhost
    // istisnasına düştüğü için Domain attribute'u ÜRETİLMEMELİ, host-only
    // davranış korunmalı. Domain=.koqep.com'un GERÇEKTEN üretildiği
    // senaryo getCsrfCookieDomain'in kendi birim testinde (auth-cookie.
    // util.spec.ts) kapsanıyor - saf fonksiyon olduğu için burada env'i
    // request-arası değiştirip yarış koşulu yaratmaya gerek yok.
    expect(refreshCookie).not.toMatch(/Domain=/i);
    expect(csrfCookie).not.toMatch(/Domain=/i);
  });

  it('cookie_ve_dogru_csrf_header_ile_bodysiz_refresh_calisir', async () => {
    const { loginResponse } = await signUpVerifyAndLogin();
    const { rt, csrf } = extractCookieValues(loginResponse);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`koqep_rt=${rt}`, `koqep_csrf=${csrf}`])
      .set('X-Csrf-Token', csrf)
      .send({})
      .expect(201);

    const body = refreshResponse.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');
  });

  it('csrf_header_eksik_veya_yanlisken_cookie_refresh_403_doner', async () => {
    const { loginResponse } = await signUpVerifyAndLogin();
    const { rt, csrf } = extractCookieValues(loginResponse);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`koqep_rt=${rt}`, `koqep_csrf=${csrf}`])
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', [`koqep_rt=${rt}`, `koqep_csrf=${csrf}`])
      .set('X-Csrf-Token', 'yanlis-deger')
      .send({})
      .expect(403);
  });

  it('logout_cookieleri_max_age_sifirla_temizler', async () => {
    const { loginResponse } = await signUpVerifyAndLogin();
    const { rt, csrf } = extractCookieValues(loginResponse);

    const logoutResponse = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', [`koqep_rt=${rt}`, `koqep_csrf=${csrf}`])
      .set('X-Csrf-Token', csrf)
      .send({})
      .expect(201);

    const setCookieHeaders = extractSetCookieHeaders(logoutResponse);
    expect(findCookie(setCookieHeaders, 'koqep_rt')).toMatch(/Max-Age=0/i);
    expect(findCookie(setCookieHeaders, 'koqep_csrf')).toMatch(/Max-Age=0/i);
  });
});

function extractSetCookieHeaders(response: request.Response): string[] {
  const raw = response.headers['set-cookie'] as string[] | string | undefined;
  if (!raw) {
    return [];
  }
  return Array.isArray(raw) ? raw : [raw];
}

function findCookie(headers: string[], name: string): string {
  const match = headers.find((header) => header.startsWith(`${name}=`));
  if (!match) {
    throw new Error(`e2e test: '${name}' cookie'si Set-Cookie'de bulunamadı.`);
  }
  return match;
}

function extractCookieValues(response: request.Response): {
  rt: string;
  csrf: string;
} {
  const headers = extractSetCookieHeaders(response);
  const rtHeader = findCookie(headers, 'koqep_rt');
  const csrfHeader = findCookie(headers, 'koqep_csrf');
  return {
    rt: rtHeader.split(';')[0].split('=')[1],
    csrf: csrfHeader.split(';')[0].split('=')[1],
  };
}

// M6 Slice A: kanıtlanabilir onay - yukarıdaki ana describe'un ValidationPipe
// UYGULAMAMASI kasıtlı (kullanıcı adı üreticisi 41 karakter, MAX_USERNAME_
// LENGTH=24'ü zaten aşıyor) - ValidationPipe'ı oraya eklemek neredeyse tüm
// mevcut testleri kırardı. Bunun yerine kendi küçük TestingModule'ü ve KISA
// kullanıcı adlarıyla ayrı bir describe.
describe('Auth signup: kanıtlanabilir onay (ValidationPipe) (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const emailServiceMock = buildEmailServiceMock();
  const passwordPolicyServiceMock = buildPasswordPolicyServiceMock();

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
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function seedInvite(): Promise<string> {
    const issuer = await prisma.user.create({
      data: {
        email: `issuer-${randomUUID()}@koqep.local`,
        username: `is-${randomUUID().slice(0, 18)}`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    const code = `code-${randomUUID()}`;
    await prisma.invite.create({ data: { code, issuedById: issuer.id } });
    return code;
  }

  it('reddeder_acceptedTerms_eksikken', async () => {
    const code = await seedInvite();

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: `su-${randomUUID()}@koqep.local`,
        username: `su-${randomUUID().slice(0, 18)}`,
        password: 'a-strong-password',
      })
      .expect(400);
  });

  it('reddeder_acceptedTerms_false_iken', async () => {
    const code = await seedInvite();

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: `su-${randomUUID()}@koqep.local`,
        username: `su-${randomUUID().slice(0, 18)}`,
        password: 'a-strong-password',
        acceptedTerms: false,
      })
      .expect(400);
  });

  it('kabul_edince_kayit_olur_ve_termsAcceptedAt_kaydedilir', async () => {
    const code = await seedInvite();
    const email = `su-${randomUUID()}@koqep.local`;

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email,
        username: `su-${randomUUID().slice(0, 18)}`,
        password: 'a-strong-password',
        acceptedTerms: true,
      })
      .expect(201);

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(createdUser.termsAcceptedAt).not.toBeNull();
  });
});
