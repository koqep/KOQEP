import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { Secret, TOTP } from 'otpauth';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

// M7a Slice C (kullanıcının review'ında bulunan asimetri boşluğu, ADR
// gerekmeyen bir uygulama-katmanı özelliği): self-servis moderatör
// atama/kaldırma. assignModerator deleteAccount'un AYNI şifre+TOTP reauth
// desenini kullanıyor - gerçek argon2 hash'li kullanıcılar gerekiyor
// (moderation.e2e-spec.ts'in 'test-not-a-real-hash' kısayolu burada
// ÇALIŞMAZ), delete-account.e2e-spec.ts'in createTestUser deseni taklit
// ediliyor.
describe('Moderator role assignment (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let baseUrl: string;
  const openSockets: Socket[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Beklenmeyen sunucu adresi formatı.');
    }
    baseUrl = `http://localhost:${address.port}`;

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    // moderation.e2e-spec.ts'in AYNI FK-sıralı temizlik deseni -
    // ModerationAuditLog satırları User'a SetNull, ama satırları test
    // DB'sinde biriktirmemek için elle temizleniyor.
    if (createdUserIds.length > 0) {
      await prisma.moderationAuditLog.deleteMany({
        where: {
          OR: [
            { moderatorId: { in: createdUserIds } },
            { targetUserId: { in: createdUserIds } },
          ],
        },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  function connectSocket(token: string): Socket {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    openSockets.push(socket);
    return socket;
  }

  async function createTestUser(role: 'user' | 'moderator' = 'user'): Promise<{
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
        role,
      },
    });
    createdUserIds.push(user.id);
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { id: user.id, email, password, accessToken };
  }

  describe('POST /moderation/users/assign-moderator', () => {
    it('dogru_sifreyle_moderator_atar_ve_denetim_satiri_yazar', async () => {
      const moderator = await createTestUser('moderator');
      const target = await createTestUser();

      const response = await request(app.getHttpServer())
        .post('/moderation/users/assign-moderator')
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ email: target.email, password: moderator.password })
        .expect(201);

      expect((response.body as { role: string }).role).toBe('moderator');
      expect(
        (response.body as { alreadyModerator: boolean }).alreadyModerator,
      ).toBe(false);

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
      });
      expect(updated.role).toBe('moderator');

      const auditRow = await prisma.moderationAuditLog.findFirst({
        where: { moderatorId: moderator.id, targetUserId: target.id },
      });
      expect(auditRow?.actionType).toBe('MODERATOR_ASSIGNED');
    });

    it('yanlis_sifre_401_invalid_credentials_doner', async () => {
      const moderator = await createTestUser('moderator');
      const target = await createTestUser();

      const response = await request(app.getHttpServer())
        .post('/moderation/users/assign-moderator')
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ email: target.email, password: 'wrong-password' })
        .expect(401);

      expect((response.body as { code: string }).code).toBe(
        'INVALID_CREDENTIALS',
      );
      const stillUser = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
      });
      expect(stillUser.role).toBe('user');
    });

    it('totp_acik_moderator_kodsuz_reddedilir_dogru_kodla_atar', async () => {
      const moderator = await createTestUser('moderator');
      const target = await createTestUser();
      const authHeader = { Authorization: `Bearer ${moderator.accessToken}` };

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
        .post('/moderation/users/assign-moderator')
        .set(authHeader)
        .send({ email: target.email, password: moderator.password })
        .expect(401);
      expect((withoutCode.body as { code: string }).code).toBe('TOTP_REQUIRED');

      await request(app.getHttpServer())
        .post('/moderation/users/assign-moderator')
        .set(authHeader)
        .send({
          email: target.email,
          password: moderator.password,
          totpCode: totp.generate(),
        })
        .expect(201);

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: target.id },
      });
      expect(updated.role).toBe('moderator');
    });

    it('bilinmeyen_hedef_email_404_doner', async () => {
      const moderator = await createTestUser('moderator');

      await request(app.getHttpServer())
        .post('/moderation/users/assign-moderator')
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({
          email: `yok-${randomUUID()}@koqep.local`,
          password: moderator.password,
        })
        .expect(404);
    });

    it('moderator_olmayan_atama_isteyemez', async () => {
      const user = await createTestUser();
      const target = await createTestUser();

      await request(app.getHttpServer())
        .post('/moderation/users/assign-moderator')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ email: target.email, password: user.password })
        .expect(403);
    });

    it('hedefin_kendi_soketi_gercek_zamanli_role_changed_alir', async () => {
      const moderator = await createTestUser('moderator');
      const target = await createTestUser();
      const targetSocket = connectSocket(target.accessToken);
      await waitForEvent(targetSocket, 'ready');
      const eventPromise = waitForEvent<{ role: string }>(
        targetSocket,
        'moderation:role-changed',
      );

      await request(app.getHttpServer())
        .post('/moderation/users/assign-moderator')
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ email: target.email, password: moderator.password })
        .expect(201);

      const payload = await eventPromise;
      expect(payload.role).toBe('moderator');
    });
  });

  describe('POST /moderation/users/revoke-moderator', () => {
    it('moderatoru_user_yapar_ve_denetim_satiri_yazar', async () => {
      const moderatorA = await createTestUser('moderator');
      const moderatorB = await createTestUser('moderator');

      const response = await request(app.getHttpServer())
        .post('/moderation/users/revoke-moderator')
        .set('Authorization', `Bearer ${moderatorA.accessToken}`)
        .send({ email: moderatorB.email })
        .expect(201);

      expect((response.body as { role: string }).role).toBe('user');

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: moderatorB.id },
      });
      expect(updated.role).toBe('user');

      const auditRow = await prisma.moderationAuditLog.findFirst({
        where: { moderatorId: moderatorA.id, targetUserId: moderatorB.id },
      });
      expect(auditRow?.actionType).toBe('MODERATOR_REVOKED');
    });

    // "Tek moderatör kendini düşüremez" kuralının tam sınırı (moderatorCount
    // <= 1) moderator-role.service.spec.ts'te kontrollü bir mock'la ZATEN
    // deterministik olarak kanıtlanıyor. Burada TEKRAR etmiyoruz - bu paylaşılan
    // e2e DB'sinde `role='moderator'` sayısı (diğer test dosyalarının/yerel
    // geçmişin biriktirdiği satırlar yüzünden) HERHANGİ bir anda bilinmiyor,
    // "count===1" varsayan bir e2e assertion'ı Slice B'nin backfill
    // idempotentlik testinde düştüğü AYNI yarış-güvensizliğe düşerdi. Bunun
    // yerine burada DETERMİNİSTİK olan tarafı kanıtlıyoruz: kendini
    // düşürmek, BAŞKA bir moderatör (kendi yarattığımız) varken HER ZAMAN
    // başarılı olmalı - pollution ne olursa olsun count en az 2.
    it('baska_moderator_varken_kendini_dusurebilir', async () => {
      const moderatorA = await createTestUser('moderator');
      await createTestUser('moderator');

      await request(app.getHttpServer())
        .post('/moderation/users/revoke-moderator')
        .set('Authorization', `Bearer ${moderatorA.accessToken}`)
        .send({ email: moderatorA.email })
        .expect(201);

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: moderatorA.id },
      });
      expect(updated.role).toBe('user');
    });

    it('iki_moderatorden_biri_digerini_dusurebilir', async () => {
      const moderatorA = await createTestUser('moderator');
      const moderatorB = await createTestUser('moderator');

      await request(app.getHttpServer())
        .post('/moderation/users/revoke-moderator')
        .set('Authorization', `Bearer ${moderatorA.accessToken}`)
        .send({ email: moderatorB.email })
        .expect(201);

      const updated = await prisma.user.findUniqueOrThrow({
        where: { id: moderatorB.id },
      });
      expect(updated.role).toBe('user');
    });

    it('moderator_olmayan_kaldirma_isteyemez', async () => {
      const user = await createTestUser();
      const target = await createTestUser('moderator');

      await request(app.getHttpServer())
        .post('/moderation/users/revoke-moderator')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({ email: target.email })
        .expect(403);
    });

    it('hedefin_kendi_soketi_gercek_zamanli_role_changed_alir', async () => {
      const moderatorA = await createTestUser('moderator');
      const moderatorB = await createTestUser('moderator');
      const targetSocket = connectSocket(moderatorB.accessToken);
      await waitForEvent(targetSocket, 'ready');
      const eventPromise = waitForEvent<{ role: string }>(
        targetSocket,
        'moderation:role-changed',
      );

      await request(app.getHttpServer())
        .post('/moderation/users/revoke-moderator')
        .set('Authorization', `Bearer ${moderatorA.accessToken}`)
        .send({ email: moderatorB.email })
        .expect(201);

      const payload = await eventPromise;
      expect(payload.role).toBe('user');
    });
  });
});
