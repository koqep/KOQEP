import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
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

describe('Moderasyon: oda yeniden adlandırma/arşivleme/silme (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let messagesService: MessagesService;
  let baseUrl: string;
  const openSockets: Socket[] = [];
  const createdRoomIds: string[] = [];
  const createdUserIds: string[] = [];
  const createdReportIds: string[] = [];

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
    messagesService = moduleFixture.get(MessagesService);
    await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    if (createdUserIds.length > 0) {
      await prisma.moderationAuditLog.deleteMany({
        where: { moderatorId: { in: createdUserIds } },
      });
    }
    if (createdReportIds.length > 0) {
      await prisma.report.deleteMany({
        where: { id: { in: createdReportIds } },
      });
    }
    if (createdRoomIds.length > 0) {
      await prisma.messageEdit.deleteMany({
        where: { message: { roomId: { in: createdRoomIds } } },
      });
      await prisma.message.deleteMany({
        where: { roomId: { in: createdRoomIds } },
      });
      await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
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

  async function createTestRoom(
    status: 'active' | 'archived' = 'active',
  ): Promise<{ id: string; name: string }> {
    const name = `oda-${randomUUID()}`;
    const room = await prisma.room.create({
      data: {
        name,
        status,
        archivedAt: status === 'archived' ? new Date() : null,
      },
    });
    createdRoomIds.push(room.id);
    return { id: room.id, name: room.name };
  }

  it('moderator_odayi_yeniden_adlandirir_ve_ilgili_kullanici_gercek_zamanli_bildirim_alir', async () => {
    const room = await createTestRoom('active');
    const moderator = await createTestUser('moderator');
    const member = await createTestUser();
    const socket = connectSocket(member.accessToken);
    await waitForEvent(socket, 'ready');

    const renamedPromise = waitForEvent<{ roomId: string; name: string }>(
      socket,
      'room:renamed',
    );
    const newName = `yeni-isim-${randomUUID()}`;

    const response = await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/rename`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ name: newName })
      .expect(201);
    expect((response.body as { name: string }).name).toBe(newName);

    const pushed = await renamedPromise;
    expect(pushed).toEqual({ roomId: room.id, name: newName });

    const dbRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(dbRoom?.name).toBe(newName);

    const audit = await prisma.moderationAuditLog.findFirst({
      where: { targetRoomId: room.id, actionType: 'ROOM_RENAMED' },
    });
    expect(audit?.targetRoomName).toBe(room.name);
  }, 15000);

  it('baska_bir_odayla_isim_cakismasi_409_doner', async () => {
    const roomA = await createTestRoom('active');
    const roomB = await createTestRoom('active');
    const moderator = await createTestUser('moderator');

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${roomA.id}/rename`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ name: roomB.name })
      .expect(409);
  });

  it('moderator_aktif_odayi_arsivler_ve_ilgili_kullanici_bildirim_alir', async () => {
    const room = await createTestRoom('active');
    const moderator = await createTestUser('moderator');
    const member = await createTestUser();
    const socket = connectSocket(member.accessToken);
    await waitForEvent(socket, 'ready');

    const archivedPromise = waitForEvent<{ roomId: string }>(
      socket,
      'room:archived',
    );

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/archive`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(201);

    const pushed = await archivedPromise;
    expect(pushed).toEqual({ roomId: room.id });

    const dbRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(dbRoom?.status).toBe('archived');
  }, 15000);

  it('zaten_aktif_olmayan_oda_arsivlenemez', async () => {
    const room = await createTestRoom('archived');
    const moderator = await createTestUser('moderator');

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/archive`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(409);
  });

  it('aktif_oda_silinemez_once_arsivlenmeli', async () => {
    const room = await createTestRoom('active');
    const moderator = await createTestUser('moderator');

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/delete`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(409);
  });

  it('arsivle_sonra_sil_tam_akis_mesajlar_gidiyor_acik_rapor_cozuluyor_ve_bildirim_ulasir', async () => {
    const room = await createTestRoom('active');
    const author = await createTestUser();
    const reporter = await createTestUser();
    const moderator = await createTestUser('moderator');

    const messageDto = await messagesService.sendMessage(
      author.id,
      room.name,
      `saldirgan-${randomUUID()}`,
    );
    await request(app.getHttpServer())
      .post(`/rooms/${room.name}/messages/${messageDto.id}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .expect(201);
    const report = await prisma.report.findFirst({
      where: { messageId: messageDto.id },
    });
    expect(report).not.toBeNull();
    if (report) createdReportIds.push(report.id);

    const member = await createTestUser();
    const socket = connectSocket(member.accessToken);
    await waitForEvent(socket, 'ready');
    const archivedPromise = waitForEvent(socket, 'room:archived');
    const deletedPromise = waitForEvent<{ roomId: string }>(
      socket,
      'room:deleted',
    );

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/archive`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(201);
    await archivedPromise;

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/delete`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(201);

    const pushed = await deletedPromise;
    expect(pushed).toEqual({ roomId: room.id });

    const dbRoom = await prisma.room.findUnique({ where: { id: room.id } });
    expect(dbRoom).toBeNull();
    const dbMessage = await prisma.message.findUnique({
      where: { id: messageDto.id },
    });
    expect(dbMessage).toBeNull();

    const resolvedReport = await prisma.report.findUnique({
      where: { id: report?.id },
    });
    expect(resolvedReport?.status).toBe('resolved');
    expect(resolvedReport?.resolvedById).toBe(moderator.id);

    const audit = await prisma.moderationAuditLog.findFirst({
      where: { moderatorId: moderator.id, actionType: 'ROOM_DELETED' },
    });
    expect(audit?.targetRoomId).toBeNull();
    expect(audit?.targetRoomName).toBe(room.name);
    expect(audit?.deletedMessageCount).toBe(1);
  }, 20000);

  it('cekirdek_oda_uc_aksiyon_icin_de_reddedilir', async () => {
    const moderator = await createTestUser('moderator');
    const coreRoom = await prisma.room.findUniqueOrThrow({
      where: { name: CORE_ROOM_NAMES[0] },
    });
    const authHeader = { Authorization: `Bearer ${moderator.accessToken}` };

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${coreRoom.id}/rename`)
      .set(authHeader)
      .send({ name: `yeni-isim-${randomUUID()}` })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/moderation/rooms/${coreRoom.id}/archive`)
      .set(authHeader)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/moderation/rooms/${coreRoom.id}/delete`)
      .set(authHeader)
      .expect(403);
  });

  it('moderator_olmayan_403_alir', async () => {
    const room = await createTestRoom('active');
    const user = await createTestUser();
    const authHeader = { Authorization: `Bearer ${user.accessToken}` };

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/rename`)
      .set(authHeader)
      .send({ name: `yeni-isim-${randomUUID()}` })
      .expect(403);
    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/archive`)
      .set(authHeader)
      .expect(403);
    await request(app.getHttpServer())
      .post(`/moderation/rooms/${room.id}/delete`)
      .set(authHeader)
      .expect(403);
  });

  it('bilinmeyen_oda_404_doner', async () => {
    const moderator = await createTestUser('moderator');
    const authHeader = { Authorization: `Bearer ${moderator.accessToken}` };

    await request(app.getHttpServer())
      .post(`/moderation/rooms/${randomUUID()}/rename`)
      .set(authHeader)
      .send({ name: `yeni-isim-${randomUUID()}` })
      .expect(404);
    await request(app.getHttpServer())
      .post(`/moderation/rooms/${randomUUID()}/archive`)
      .set(authHeader)
      .expect(404);
    await request(app.getHttpServer())
      .post(`/moderation/rooms/${randomUUID()}/delete`)
      .set(authHeader)
      .expect(404);
  });
});
