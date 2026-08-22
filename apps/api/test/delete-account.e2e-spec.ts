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
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';
import { EmailService } from './../src/services/email.service';
import { buildEmailServiceMock } from './support/email-service-mock';
import { PasswordPolicyService } from './../src/services/password-policy.service';
import { buildPasswordPolicyServiceMock } from './support/password-policy-mock';

describe('Account deletion (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    // Aşağıdaki "invite hâlâ kullanılabilir" testi gerçek /auth/signup
    // çağırıyor - EmailService mock'lanmazsa CI'daki sahte RESEND_API_KEY
    // ile gerçek Resend çağrısı 401 döner (bkz. support/email-service-mock.ts).
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(buildEmailServiceMock())
      .overrideProvider(PasswordPolicyService)
      .useValue(buildPasswordPolicyServiceMock())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  // Bu dosya signup/e-posta doğrulama akışını değil hesap silmeyi test
  // ediyor - doğrulanmış bir kullanıcıyı doğrudan oluşturup token
  // imzalıyoruz (M2.5 Slice B/C'nin diğer dosyalarındaki aynı desen).
  // Şifre gerçek argon2 hash'i çünkü test gerçek /auth/delete-account
  // çağırıyor.
  async function createTestUser(): Promise<{
    id: string;
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
    return { id: user.id, email, password, accessToken };
  }

  it('reddeder_yanlis_sifreyi', async () => {
    const user = await createTestUser();

    const response = await request(app.getHttpServer())
      .post('/auth/delete-account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: 'wrong-password' })
      .expect(401);

    expect((response.body as { code: string }).code).toBe(
      'INVALID_CREDENTIALS',
    );

    const stillThere = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(stillThere).not.toBeNull();
  });

  it('reddeder_kimliksiz_istegi', async () => {
    await request(app.getHttpServer())
      .post('/auth/delete-account')
      .send({ password: 'x' })
      .expect(401);
  });

  it('siler_hesabi_ve_ilgili_tum_satirlari_gercekten_kaldirir_ve_mesaj_yazari_anonimlesir', async () => {
    const user = await createTestUser();

    // İlgili her tabloda gerçekten satır var mı, silmeden önce doğrula -
    // yoksa "silindi" testi hiçbir şeyi kanıtlamaz.
    await prisma.refreshToken.create({
      data: {
        tokenHash: `hash-${randomUUID()}`,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        userId: user.id,
      },
    });
    const otherUser = await createTestUser();
    await prisma.block.create({
      data: { blockerId: user.id, blockedId: otherUser.id },
    });
    const invite = await prisma.invite.create({
      data: { code: `INV-${randomUUID()}`, issuedById: user.id },
    });
    // Yeni bir Room OLUŞTURMA - room adları rooms.service.ts'te alfabetik
    // sıralanıyor ve RoomView.tsx ilk odayı otomatik seçiyor; rastgele
    // isimli yeni bir oda "general"den önce sıralanıp fullstack testlerin
    // varsaydığı varsayılan odayı sessizce değiştirebilir (bu gerçekten
    // yaşandı, düzeltildi). Mevcut çekirdek odayı kullan - diğer e2e
    // dosyalarının (blocks.e2e-spec.ts vb.) zaten yaptığı gibi.
    const room = await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
    const message = await prisma.message.create({
      data: { roomId: room.id, authorId: user.id, content: 'silinecek yazar' },
    });

    await request(app.getHttpServer())
      .post('/auth/delete-account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: user.password })
      .expect(201)
      .expect({ ok: true });

    const deletedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(deletedUser).toBeNull();

    const remainingRefreshTokens = await prisma.refreshToken.count({
      where: { userId: user.id },
    });
    expect(remainingRefreshTokens).toBe(0);

    const remainingBlocks = await prisma.block.count({
      where: { blockerId: user.id },
    });
    expect(remainingBlocks).toBe(0);

    // ADR-0005: mesaj içeriği kalıyor, yazar bağlantısı anonimleşiyor.
    const survivingMessage = await prisma.message.findUnique({
      where: { id: message.id },
    });
    expect(survivingMessage?.content).toBe('silinecek yazar');
    expect(survivingMessage?.authorId).toBeNull();

    const messagesResponse = await request(app.getHttpServer())
      .get(`/rooms/${room.name}/messages`)
      .set('Authorization', `Bearer ${otherUser.accessToken}`)
      .expect(200);
    const { messages } = messagesResponse.body as {
      messages: { id: string; authorUsername: string | null }[];
    };
    const dto = messages.find((m) => m.id === message.id);
    expect(dto?.authorUsername).toBeNull();

    // Invite.issuedById SET NULL - davet hâlâ kullanılabilir kalmalı.
    const survivingInvite = await prisma.invite.findUnique({
      where: { id: invite.id },
    });
    expect(survivingInvite?.issuedById).toBeNull();
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: invite.code,
        email: `redeemer-${randomUUID()}@koqep.local`,
        username: `redeemer${randomUUID()}`,
        password: 'a-strong-password',
      })
      .expect(201);
  });

  // M6c Slice B (ADR-0005 Addendum #2): yukarıdaki test flag GÖNDERMEDEN
  // silme yapıp içeriğin AYNEN kaldığını doğruluyor (varsayılan davranış
  // değişmedi) - bu test redactMessageContent:true iken içeriğin gerçekten
  // AUTHOR_DELETED_CONTENT'e döndüğünü kanıtlıyor, üçü de (Message/
  // MessageEdit/Report).
  it('redactMessageContent_true_iken_mesaj_gecmis_ve_rapor_icerigini_gercekten_redakte_eder', async () => {
    const user = await createTestUser();
    const otherUser = await createTestUser();
    const room = await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
    const message = await prisma.message.create({
      data: {
        roomId: room.id,
        authorId: user.id,
        content: 'ben Ahmet, ahmet@ornek.com',
      },
    });
    const edit = await prisma.messageEdit.create({
      data: {
        messageId: message.id,
        previousContent: 'ilk hali - kimlik ifsasi',
      },
    });
    const report = await prisma.report.create({
      data: {
        messageId: message.id,
        reporterId: otherUser.id,
        reportedUserId: user.id,
        reportedContent: 'ben Ahmet, ahmet@ornek.com',
      },
    });

    await request(app.getHttpServer())
      .post('/auth/delete-account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: user.password, redactMessageContent: true })
      .expect(201)
      .expect({ ok: true });

    const redactedMessage = await prisma.message.findUnique({
      where: { id: message.id },
    });
    expect(redactedMessage?.content).toBe(
      '[Bu mesaj yazarı tarafından silindi.]',
    );
    expect(redactedMessage?.authorId).toBeNull();

    const redactedEdit = await prisma.messageEdit.findUnique({
      where: { id: edit.id },
    });
    expect(redactedEdit?.previousContent).toBe(
      '[Bu mesaj yazarı tarafından silindi.]',
    );

    const redactedReport = await prisma.report.findUnique({
      where: { id: report.id },
    });
    expect(redactedReport?.reportedContent).toBe(
      '[Bu mesaj yazarı tarafından silindi.]',
    );
  });

  it('reddeder_ikinci_cagriyi_401le_500_degil', async () => {
    const user = await createTestUser();

    await request(app.getHttpServer())
      .post('/auth/delete-account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: user.password })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/delete-account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: user.password })
      .expect(401);
  });

  describe('TOTP etkinken', () => {
    it('reddeder_totp_kodu_olmadan_ve_siler_dogru_kodla', async () => {
      const user = await createTestUser();
      const authHeader = { Authorization: `Bearer ${user.accessToken}` };

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

      const withoutCode = await request(app.getHttpServer())
        .post('/auth/delete-account')
        .set(authHeader)
        .send({ password: user.password })
        .expect(401);
      expect((withoutCode.body as { code: string }).code).toBe('TOTP_REQUIRED');

      await request(app.getHttpServer())
        .post('/auth/delete-account')
        .set(authHeader)
        .send({ password: user.password, totpCode: totp.generate() })
        .expect(201);

      const deletedUser = await prisma.user.findUnique({
        where: { id: user.id },
      });
      expect(deletedUser).toBeNull();
    });
  });
});
