import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { MessagesService } from './../src/services/messages.service';
import { InvitesService } from './../src/services/invites.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';
import { EmailService } from './../src/services/email.service';
import { buildEmailServiceMock } from './support/email-service-mock';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('Moderasyon: geçici susturma (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let messagesService: MessagesService;
  let invitesService: InvitesService;
  let baseUrl: string;
  const openSockets: Socket[] = [];
  const createdMessageIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    // Bu dosyanın odağı susturma - ama davetçi hesap verebilirliği testleri
    // gerçek /auth/signup'ı tetikliyor (revoke edilmiş bir davetin 409
    // döndüğünü doğrulamak için), o da EmailService'e dokunuyor (testing.md).
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(buildEmailServiceMock())
      .compile();

    app = moduleFixture.createNestApplication();
    // main.ts'in bootstrap'ının AYNISI - diğer e2e dosyaları bunu hiç
    // uygulamıyor (TestingModule main.ts'i hiç çalıştırmıyor), bu yüzden
    // DTO validasyonu (MuteUserDto'nun @Min/@Max'ı) hiçbirinde gerçekten
    // test edilmiyor. Bu dosyaya özgü ekleme - diğer dosyaları etkilemiyor.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Beklenmeyen sunucu adresi formatı.');
    }
    baseUrl = `http://localhost:${address.port}`;

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
    messagesService = moduleFixture.get(MessagesService);
    invitesService = moduleFixture.get(InvitesService);
    await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    // moderatorId VEYA targetUserId'ye göre - MUTE_APPLIED/MUTE_LIFTED
    // satırları moderatorId taşır, ama M5 Slice E'nin
    // INVITER_INVITE_REVOKED/_DEBT_INCURRED satırları moderatorId'yi
    // BİLEREK null bırakıp hedefi targetUserId'ye (davetçi) yazıyor -
    // ÖNCE audit satırları, SONRA kullanıcılar siliniyor (User silinince
    // her iki alan da SetNull ile null'a düşebileceği için).
    if (createdUserIds.length > 0) {
      await prisma.moderationAuditLog.deleteMany({
        where: {
          OR: [
            { moderatorId: { in: createdUserIds } },
            { targetUserId: { in: createdUserIds } },
          ],
        },
      });
      await prisma.invite.deleteMany({
        where: { issuedById: { in: createdUserIds } },
      });
    }
    if (createdMessageIds.length > 0) {
      await prisma.messageEdit.deleteMany({
        where: { messageId: { in: createdMessageIds } },
      });
      await prisma.message.deleteMany({
        where: { id: { in: createdMessageIds } },
      });
    }
    if (createdUserIds.length > 0) {
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

  async function createTestUser(
    role: 'user' | 'moderator' = 'user',
    inviterId?: string,
  ): Promise<{ id: string; email: string; accessToken: string }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: 'test-not-a-real-hash',
        emailVerifiedAt: new Date(),
        role,
        inviterId,
      },
    });
    createdUserIds.push(user.id);
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { id: user.id, email, accessToken };
  }

  async function createMessage(
    authorId: string,
    content: string,
  ): Promise<string> {
    const dto = await messagesService.sendMessage(
      authorId,
      CORE_ROOM_NAMES[0],
      content,
    );
    createdMessageIds.push(dto.id);
    return dto.id;
  }

  it('moderator_susturur_hedef_kullanici_gercek_zamanli_bildirim_alir_ve_denetim_satiri_yazilir', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser('moderator');
    const socket = connectSocket(author.accessToken);
    await waitForEvent(socket, 'ready');

    const mutedPromise = waitForEvent<{ mutedUntil: string }>(
      socket,
      'moderation:muted',
    );

    const response = await request(app.getHttpServer())
      .post(`/moderation/users/${author.id}/mute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ durationHours: 1 })
      .expect(201);
    expect(response.body).toHaveProperty('mutedUntil');

    const pushed = await mutedPromise;
    expect(pushed.mutedUntil).toBeTruthy();

    const dbUser = await prisma.user.findUnique({ where: { id: author.id } });
    expect(dbUser?.mutedUntil).not.toBeNull();

    const auditEntries = await prisma.moderationAuditLog.findMany({
      where: { moderatorId: moderator.id, targetUserId: author.id },
    });
    expect(
      auditEntries.some((entry) => entry.actionType === 'MUTE_APPLIED'),
    ).toBe(true);
  }, 15000);

  it('susturulmus_kullanicinin_gonderimi_ve_duzenlemesi_muted_koduyla_reddedilir', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);

    await request(app.getHttpServer())
      .post(`/moderation/users/${author.id}/mute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ durationHours: 1 })
      .expect(201);

    const socket = connectSocket(author.accessToken);
    await waitForEvent(socket, 'ready');

    const sendExceptionPromise = waitForEvent<{ code: string }>(
      socket,
      'exception',
    );
    socket.emit('message:send', { content: `susturulmus-${randomUUID()}` });
    const sendException = await sendExceptionPromise;
    expect(sendException.code).toBe('MUTED');

    const editExceptionPromise = waitForEvent<{ code: string }>(
      socket,
      'exception',
    );
    socket.emit('message:edit', {
      messageId,
      content: `susturulmus-duzenleme-${randomUUID()}`,
    });
    const editException = await editExceptionPromise;
    expect(editException.code).toBe('MUTED');
  }, 15000);

  it('moderator_susturmayi_kaldirir_ve_tekrar_gonderime_izin_verilir', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser('moderator');

    await request(app.getHttpServer())
      .post(`/moderation/users/${author.id}/mute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ durationHours: 1 })
      .expect(201);

    const socket = connectSocket(author.accessToken);
    await waitForEvent(socket, 'ready');
    const unmutedPromise = waitForEvent(socket, 'moderation:unmuted');

    await request(app.getHttpServer())
      .post(`/moderation/users/${author.id}/unmute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(201);
    await unmutedPromise;

    const sendAck = await new Promise<{ status: string }>((resolve) => {
      socket.emit(
        'message:send',
        { content: `susturma-kalkti-${randomUUID()}` },
        resolve,
      );
    });
    expect(sendAck).toEqual({ status: 'ok' });
    const createdRow = await prisma.message.findFirst({
      where: { authorId: author.id },
      orderBy: { createdAt: 'desc' },
    });
    if (createdRow) createdMessageIds.push(createdRow.id);

    const auditEntries = await prisma.moderationAuditLog.findMany({
      where: { moderatorId: moderator.id, targetUserId: author.id },
    });
    expect(
      auditEntries.some((entry) => entry.actionType === 'MUTE_LIFTED'),
    ).toBe(true);
  }, 15000);

  it('moderator_olmayan_susturma_isteyemez', async () => {
    const author = await createTestUser();
    const nonModerator = await createTestUser();

    await request(app.getHttpServer())
      .post(`/moderation/users/${author.id}/mute`)
      .set('Authorization', `Bearer ${nonModerator.accessToken}`)
      .send({ durationHours: 1 })
      .expect(403);
  });

  it('gecersiz_sureyi_400_ile_reddeder', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser('moderator');

    await request(app.getHttpServer())
      .post(`/moderation/users/${author.id}/mute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ durationHours: 0 })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/moderation/users/${author.id}/mute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ durationHours: 721 })
      .expect(400);
  });

  it('var_olmayan_kullanici_icin_404_doner', async () => {
    const moderator = await createTestUser('moderator');

    await request(app.getHttpServer())
      .post(`/moderation/users/${randomUUID()}/mute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ durationHours: 1 })
      .expect(404);
  });

  describe('davetçi hesap verebilirliği (B15)', () => {
    it('davetcinin_kullanilmamis_daveti_susturma_ile_iptal_edilir_ve_denetim_satirina_yazilir', async () => {
      const inviter = await createTestUser();
      const invite = await prisma.invite.create({
        data: { code: `code-${randomUUID()}`, issuedById: inviter.id },
      });
      const target = await createTestUser('user', inviter.id);
      const moderator = await createTestUser('moderator');

      await request(app.getHttpServer())
        .post(`/moderation/users/${target.id}/mute`)
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ durationHours: 1 })
        .expect(201);

      const revokedInvite = await prisma.invite.findUnique({
        where: { id: invite.id },
      });
      expect(revokedInvite?.revokedAt).not.toBeNull();

      const inviterAudit = await prisma.moderationAuditLog.findMany({
        where: { targetUserId: inviter.id },
      });
      expect(inviterAudit).toHaveLength(1);
      expect(inviterAudit[0].actionType).toBe('INVITER_INVITE_REVOKED');
      expect(inviterAudit[0].targetInviteId).toBe(invite.id);
      expect(inviterAudit[0].moderatorId).toBeNull();
    }, 15000);

    it('davetcinin_kullanilmamis_daveti_yoksa_borc_birikir_ve_sonraki_kazanimda_karsilanir', async () => {
      const inviter = await createTestUser();
      const target = await createTestUser('user', inviter.id);
      const moderator = await createTestUser('moderator');

      await request(app.getHttpServer())
        .post(`/moderation/users/${target.id}/mute`)
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ durationHours: 1 })
        .expect(201);

      const inviterAfterMute = await prisma.user.findUnique({
        where: { id: inviter.id },
      });
      expect(inviterAfterMute?.pendingInviteDebt).toBe(1);

      const inviterAudit = await prisma.moderationAuditLog.findMany({
        where: { targetUserId: inviter.id },
      });
      expect(inviterAudit).toHaveLength(1);
      expect(inviterAudit[0].actionType).toBe('INVITER_INVITE_DEBT_INCURRED');
      expect(inviterAudit[0].moderatorId).toBeNull();

      // Bir sonraki gerçek kazanım (seviye atlama akışıyla aynı çağrı) önce
      // borcu karşılıyor, hiç Invite satırı yazmıyor.
      await prisma.$transaction((tx) =>
        invitesService.grantInvites(tx, inviter.id, 1),
      );
      const inviterAfterGrant = await prisma.user.findUnique({
        where: { id: inviter.id },
      });
      expect(inviterAfterGrant?.pendingInviteDebt).toBe(0);
      const grantedInvites = await prisma.invite.findMany({
        where: { issuedById: inviter.id },
      });
      expect(grantedInvites).toHaveLength(0);
    }, 15000);

    it('davetcisi_olmayan_kullaniciyi_susturmak_denetim_satiri_uretmez', async () => {
      const target = await createTestUser();
      const moderator = await createTestUser('moderator');

      await request(app.getHttpServer())
        .post(`/moderation/users/${target.id}/mute`)
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ durationHours: 1 })
        .expect(201);

      const inviterActionRows = await prisma.moderationAuditLog.findMany({
        where: {
          actionType: {
            in: ['INVITER_INVITE_REVOKED', 'INVITER_INVITE_DEBT_INCURRED'],
          },
          targetUserId: target.id,
        },
      });
      expect(inviterActionRows).toHaveLength(0);
    }, 15000);

    it('zaten_susturulmus_kullaniciyi_yeniden_mute_etmek_davetciyi_ikinci_kez_etkilemez', async () => {
      const inviter = await createTestUser();
      await prisma.invite.create({
        data: { code: `code-${randomUUID()}`, issuedById: inviter.id },
      });
      const secondInvite = await prisma.invite.create({
        data: { code: `code-${randomUUID()}`, issuedById: inviter.id },
      });
      const target = await createTestUser('user', inviter.id);
      const moderator = await createTestUser('moderator');

      await request(app.getHttpServer())
        .post(`/moderation/users/${target.id}/mute`)
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ durationHours: 1 })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/moderation/users/${target.id}/mute`)
        .set('Authorization', `Bearer ${moderator.accessToken}`)
        .send({ durationHours: 24 })
        .expect(201);

      const inviterAudit = await prisma.moderationAuditLog.findMany({
        where: { targetUserId: inviter.id },
      });
      expect(inviterAudit).toHaveLength(1);

      const untouchedInvite = await prisma.invite.findUnique({
        where: { id: secondInvite.id },
      });
      expect(untouchedInvite?.revokedAt).toBeNull();
    }, 15000);

    it('revoke_edilmis_davet_koduyla_gercek_signup_409_doner', async () => {
      const inviter = await createTestUser();
      const invite = await prisma.invite.create({
        data: {
          code: `code-${randomUUID()}`,
          issuedById: inviter.id,
          revokedAt: new Date(),
        },
      });

      await request(app.getHttpServer())
        .post('/auth/signup')
        .send({
          inviteCode: invite.code,
          email: `signup-${randomUUID()}@koqep.local`,
          username: `su-${randomUUID().slice(0, 18)}`,
          password: 'a-strong-password',
          acceptedTerms: true,
        })
        .expect(409);
    });
  });
});
