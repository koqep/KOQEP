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
import { joinRoomByName } from './support/room-membership';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('Moderation: rapor + inceleme + aksiyon (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let messagesService: MessagesService;
  let baseUrl: string;
  const openSockets: Socket[] = [];
  const createdMessageIds: string[] = [];
  const createdReportIds: string[] = [];
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
    messagesService = moduleFixture.get(MessagesService);
    await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    // ModerationAuditLog Report'a SetNull - Report SİLİNMEDEN ÖNCE
    // silinmeli, yoksa reportId null'a düşer ve where filtresi eşleşmez.
    if (createdReportIds.length > 0) {
      await prisma.moderationAuditLog.deleteMany({
        where: { reportId: { in: createdReportIds } },
      });
      await prisma.report.deleteMany({
        where: { id: { in: createdReportIds } },
      });
    }
    // REPORT_QUEUE_VIEWED satırları hiçbir raporu HEDEF ALMAZ (reportId
    // null, "kuyruk görüntülendi" olayı - bkz. reports.service.ts) -
    // yukarıdaki reportId filtresi bunları hiç yakalamaz. Bu test
    // dosyasının oluşturduğu moderatörlerin ürettiği satırları ayrıca
    // temizle.
    if (createdUserIds.length > 0) {
      await prisma.moderationAuditLog.deleteMany({
        where: { moderatorId: { in: createdUserIds }, reportId: null },
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
    // M7a Slice B: handleConnection artık sadece üye olunan odalara join
    // ediyor - bu dosyanın moderatör-gerçek-zamanlı testi general'de
    // teslimat bekliyor.
    await joinRoomByName(prisma, user.id, CORE_ROOM_NAMES[0]);
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

  it('kullanici_bir_mesaji_raporlayabilir', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const messageId = await createMessage(
      author.id,
      `saldirgan-${randomUUID()}`,
    );

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .send({ reason: 'test raporu' })
      .expect(201);

    const report = await prisma.report.findFirst({ where: { messageId } });
    expect(report).not.toBeNull();
    if (report) createdReportIds.push(report.id);
    expect(report?.status).toBe('open');
    expect(report?.reportedUserId).toBe(author.id);
  });

  it('kendi_mesajini_raporlamak_403_doner', async () => {
    const author = await createTestUser();
    const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(403);
  });

  it('bilinmeyen_mesaj_icin_404_doner', async () => {
    const reporter = await createTestUser();

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${randomUUID()}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .expect(404);
  });

  it('saatte_bes_rapordan_fazlasini_ayni_kullanici_icin_engeller', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const authHeader = { Authorization: `Bearer ${reporter.accessToken}` };

    for (let i = 0; i < 5; i++) {
      const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);
      await request(app.getHttpServer())
        .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
        .set(authHeader)
        .expect(201);
      const report = await prisma.report.findFirst({ where: { messageId } });
      if (report) createdReportIds.push(report.id);
    }

    const lastMessageId = await createMessage(
      author.id,
      `mesaj-${randomUUID()}`,
    );
    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${lastMessageId}/report`)
      .set(authHeader)
      .expect(429);
  }, 15000);

  it('moderator_olmayan_rapor_kuyrugunu_goremez', async () => {
    const user = await createTestUser();

    await request(app.getHttpServer())
      .get('/moderation/reports')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .expect(403);
  });

  it('moderator_acik_raporlari_gorur_icerik_kaldirinca_gercek_zamanli_yayinlanir', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(
      author.id,
      `saldirgan-${randomUUID()}`,
    );

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .expect(201);
    const report = await prisma.report.findFirst({ where: { messageId } });
    expect(report).not.toBeNull();
    if (!report) throw new Error('rapor oluşmadı');
    createdReportIds.push(report.id);

    const listResponse = await request(app.getHttpServer())
      .get('/moderation/reports')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);
    const reports = listResponse.body as { id: string }[];
    expect(reports.some((r) => r.id === report.id)).toBe(true);

    const authorSocket = connectSocket(author.accessToken);
    await waitForEvent(authorSocket, 'ready');
    const updatedPromise = waitForEvent<{ content: string }>(
      authorSocket,
      'message:updated',
    );

    await request(app.getHttpServer())
      .post(`/moderation/reports/${report.id}/remove-content`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ reason: 'kural ihlali' })
      .expect(201);

    const updated = await updatedPromise;
    expect(updated.content).toBe(
      '[Bu mesaj bir moderatör tarafından kaldırıldı.]',
    );

    const resolvedReport = await prisma.report.findUnique({
      where: { id: report.id },
    });
    expect(resolvedReport?.status).toBe('resolved');
    const auditEntries = await prisma.moderationAuditLog.findMany({
      where: { reportId: report.id },
    });
    expect(
      auditEntries.some((entry) => entry.actionType === 'CONTENT_REMOVED'),
    ).toBe(true);
  }, 15000);

  it('moderator_raporu_reddedebilir', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(author.id, `masum-${randomUUID()}`);

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .expect(201);
    const report = await prisma.report.findFirst({ where: { messageId } });
    if (!report) throw new Error('rapor oluşmadı');
    createdReportIds.push(report.id);

    await request(app.getHttpServer())
      .post(`/moderation/reports/${report.id}/dismiss`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(201);

    const dismissed = await prisma.report.findUnique({
      where: { id: report.id },
    });
    expect(dismissed?.status).toBe('dismissed');
  });

  it('cozulmus_bir_raporu_tekrar_cozmeye_calismak_conflict_doner', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .expect(201);
    const report = await prisma.report.findFirst({ where: { messageId } });
    if (!report) throw new Error('rapor oluşmadı');
    createdReportIds.push(report.id);

    await request(app.getHttpServer())
      .post(`/moderation/reports/${report.id}/dismiss`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(201);

    await request(app.getHttpServer())
      .post(`/moderation/reports/${report.id}/dismiss`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(409);
  });

  it('mesaj_editlense_bile_raporlanan_icerik_snapshotu_degismez', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const originalContent = `orijinal-${randomUUID()}`;
    const messageId = await createMessage(author.id, originalContent);

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .expect(201);
    const report = await prisma.report.findFirst({ where: { messageId } });
    if (!report) throw new Error('rapor oluşmadı');
    createdReportIds.push(report.id);

    await messagesService.editMessage(
      author.id,
      messageId,
      'masum-hale-getirildi',
    );

    const persisted = await prisma.report.findUnique({
      where: { id: report.id },
    });
    expect(persisted?.reportedContent).toBe(originalContent);
  });

  it('uc_farkli_kullanici_ayni_kisiyi_raporlayinca_isFlagged_true_gorunur', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);

    for (let i = 0; i < 3; i++) {
      const reporter = await createTestUser();
      await request(app.getHttpServer())
        .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .expect(201);
    }
    const reports = await prisma.report.findMany({ where: { messageId } });
    createdReportIds.push(...reports.map((r) => r.id));

    const listResponse = await request(app.getHttpServer())
      .get('/moderation/reports')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);
    const body = listResponse.body as {
      id: string;
      isFlagged: boolean;
      distinctReporterCount: number;
    }[];
    const flaggedRows = body.filter((r) =>
      reports.some((report) => report.id === r.id),
    );
    expect(flaggedRows).toHaveLength(3);
    expect(flaggedRows.every((r) => r.isFlagged)).toBe(true);
    expect(flaggedRows.every((r) => r.distinctReporterCount === 3)).toBe(true);
  }, 15000);

  it('iki_farkli_kullanici_esigi_gecmez', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);

    for (let i = 0; i < 2; i++) {
      const reporter = await createTestUser();
      await request(app.getHttpServer())
        .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .expect(201);
    }
    const reports = await prisma.report.findMany({ where: { messageId } });
    createdReportIds.push(...reports.map((r) => r.id));

    const listResponse = await request(app.getHttpServer())
      .get('/moderation/reports')
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);
    const body = listResponse.body as { id: string; isFlagged: boolean }[];
    const flaggedRows = body.filter((r) =>
      reports.some((report) => report.id === r.id),
    );
    expect(flaggedRows).toHaveLength(2);
    expect(flaggedRows.every((r) => !r.isFlagged)).toBe(true);
  });

  it('susturulmus_kullanici_hala_rapor_atabilir', async () => {
    const author = await createTestUser();
    const reporter = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);

    await request(app.getHttpServer())
      .post(`/moderation/users/${reporter.id}/mute`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .send({ durationHours: 1, reason: 'kural ihlali' })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
      .set('Authorization', `Bearer ${reporter.accessToken}`)
      .expect(201);

    const report = await prisma.report.findFirst({ where: { messageId } });
    if (report) createdReportIds.push(report.id);
  });

  it('cozum_aninda_denetim_satirina_distinct_raporcu_sayisi_yazilir', async () => {
    const author = await createTestUser();
    const moderator = await createTestUser('moderator');
    const messageId = await createMessage(author.id, `mesaj-${randomUUID()}`);

    for (let i = 0; i < 3; i++) {
      const reporter = await createTestUser();
      await request(app.getHttpServer())
        .post(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/report`)
        .set('Authorization', `Bearer ${reporter.accessToken}`)
        .expect(201);
    }
    const reports = await prisma.report.findMany({ where: { messageId } });
    createdReportIds.push(...reports.map((r) => r.id));
    const [firstReport] = reports;

    await request(app.getHttpServer())
      .post(`/moderation/reports/${firstReport.id}/dismiss`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(201);

    const auditEntry = await prisma.moderationAuditLog.findFirst({
      where: { reportId: firstReport.id, actionType: 'REPORT_DISMISSED' },
    });
    // Diğer iki rapor hâlâ 'open' - okuma firstReport'un kendi durumu
    // değişmeden ÖNCE yapıldığı için o da dahil, 3 çıkması bekleniyor.
    expect(auditEntry?.distinctReporterCountAtResolution).toBe(3);
  }, 15000);
});
