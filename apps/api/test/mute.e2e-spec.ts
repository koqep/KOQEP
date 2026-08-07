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
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('Moderasyon: geçici susturma (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let messagesService: MessagesService;
  let baseUrl: string;
  const openSockets: Socket[] = [];
  const createdMessageIds: string[] = [];
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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
    await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    // moderatorId'ye göre - MUTE_APPLIED/MUTE_LIFTED satırlarının hepsini
    // yakalar (targetUserId'ye göre filtrelemek User silinince SetNull ile
    // null'a düşebileceği için güvenilmez, moderatorId de aynı riski
    // taşıdığı için ÖNCE audit satırları, SONRA kullanıcılar siliniyor).
    if (createdUserIds.length > 0) {
      await prisma.moderationAuditLog.deleteMany({
        where: { moderatorId: { in: createdUserIds } },
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
});
