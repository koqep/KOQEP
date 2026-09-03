process.env.CRON_SECRET = 'test-cron-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

const ARCHIVE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const DELETE_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

describe('Rooms lifecycle sweep (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdRoomIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    if (createdRoomIds.length > 0) {
      // Child->parent sırası: hayatta kalması beklenen fixture'lar (purge
      // testleri) mesaj taşıyor - RESTRICT FK'si önce onlar gitmeden
      // Room'u silmeyi engeller. Sweep'in zaten sildiği odalarda bu
      // deleteMany'ler sıfır eşleşmeyle sessizce no-op olur.
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

  it('dogru_sirla_ile_2xx_doner', async () => {
    await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .set('x-cron-secret', 'test-cron-secret')
      .expect(201);
  });

  it('yanlis_sirla_401_doner', async () => {
    const response = await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .set('x-cron-secret', 'yanlis-sirla')
      .expect(401);
    expect((response.body as { code?: string }).code).toBe(
      'INVALID_CRON_SECRET',
    );
  });

  it('sirla_eksikse_401_doner', async () => {
    const response = await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .expect(401);
    expect((response.body as { code?: string }).code).toBe(
      'INVALID_CRON_SECRET',
    );
  });

  it('14_gunden_eski_gercek_bir_odayi_arsivler', async () => {
    // Gerçek geriye-tarihleme (rooms.e2e-spec.ts'in aksine burada POST
    // /rooms kullanılmıyor - lastActivityAt'i doğrudan geçmişe yazmak
    // için doğrudan prisma.room.create daha basit).
    const name = `sessiz-oda-${randomUUID()}`;
    const room = await prisma.room.create({
      data: {
        name,
        status: 'active',
        lastActivityAt: new Date(Date.now() - ARCHIVE_AFTER_MS - 1000),
      },
    });
    createdRoomIds.push(room.id);

    const response = await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .set('x-cron-secret', 'test-cron-secret')
      .expect(201);

    expect(
      (response.body as { archived: number }).archived,
    ).toBeGreaterThanOrEqual(1);

    const updated = await prisma.room.findUnique({ where: { id: room.id } });
    expect(updated?.status).toBe('archived');
    expect(updated?.archivedAt).not.toBeNull();
  });

  it('60_gunden_eski_hic_goruntulenmemis_arsivlenmis_bir_odayi_mesajlariyla_birlikte_siler', async () => {
    const name = `unutulmus-oda-${randomUUID()}`;
    const room = await prisma.room.create({
      data: {
        name,
        status: 'archived',
        archivedAt: new Date(Date.now() - DELETE_AFTER_MS - 1000),
        lastViewedAt: null,
      },
    });
    createdRoomIds.push(room.id);
    const message = await prisma.message.create({
      data: { content: 'kimsenin görmediği bir mesaj', roomId: room.id },
    });
    await prisma.messageEdit.create({
      data: { messageId: message.id, previousContent: 'eski hal' },
    });

    const response = await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .set('x-cron-secret', 'test-cron-secret')
      .expect(201);

    expect(
      (response.body as { deleted: number }).deleted,
    ).toBeGreaterThanOrEqual(1);

    const roomAfter = await prisma.room.findUnique({ where: { id: room.id } });
    const messageAfter = await prisma.message.findUnique({
      where: { id: message.id },
    });
    expect(roomAfter).toBeNull();
    expect(messageAfter).toBeNull();
  });

  it('yakin_zamanda_goruntulenmis_arsivlenmis_bir_oda_hayatta_kalir', async () => {
    const name = `yakinda-bakilan-oda-${randomUUID()}`;
    const archivedAt = new Date(Date.now() - DELETE_AFTER_MS - 1000);
    const room = await prisma.room.create({
      data: {
        name,
        status: 'archived',
        archivedAt,
        lastViewedAt: new Date(archivedAt.getTime() + 1000), // arşivden sonra görüntülenmiş
      },
    });
    createdRoomIds.push(room.id);

    await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .set('x-cron-secret', 'test-cron-secret')
      .expect(201);

    const roomAfter = await prisma.room.findUnique({ where: { id: room.id } });
    expect(roomAfter).not.toBeNull();
  });

  it('henuz_60_gun_dolmamis_arsivlenmis_bir_oda_hayatta_kalir', async () => {
    const name = `daha_yeni_arsiv-${randomUUID()}`;
    const room = await prisma.room.create({
      data: {
        name,
        status: 'archived',
        archivedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        lastViewedAt: null,
      },
    });
    createdRoomIds.push(room.id);

    await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .set('x-cron-secret', 'test-cron-secret')
      .expect(201);

    const roomAfter = await prisma.room.findUnique({ where: { id: room.id } });
    expect(roomAfter).not.toBeNull();
  });
});
