process.env.CRON_SECRET = 'test-cron-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

const ARCHIVE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

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
    await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .set('x-cron-secret', 'yanlis-sirla')
      .expect(401);
  });

  it('sirla_eksikse_401_doner', async () => {
    await request(app.getHttpServer())
      .post('/internal/rooms/lifecycle-sweep')
      .expect(401);
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
});
