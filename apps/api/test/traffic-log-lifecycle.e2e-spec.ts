process.env.CRON_SECRET = 'test-cron-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'node:crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

// 18 ay ~= 547 gün - servisin kendi takvim-ayı hesabıyla (traffic-log.
// service.spec.ts) birebir aynı OLMASI GEREKMEZ burada, sadece "kesinlikle
// 18 aydan eski" ve "kesinlikle 18 aydan yeni" iki uç nokta yeterli.
const CLEARLY_OLD_MS = 550 * 24 * 60 * 60 * 1000;
const CLEARLY_RECENT_MS = 30 * 24 * 60 * 60 * 1000;

describe('Traffic log purge (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  const createdRowIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    if (createdRowIds.length > 0) {
      // Sweep'in zaten sildiği satırlarda bu deleteMany sıfır eşleşmeyle
      // sessizce no-op olur.
      await prisma.trafficLog.deleteMany({
        where: { id: { in: createdRowIds } },
      });
    }
    await app.close();
  });

  function seedRow(createdAt: Date): Promise<{ id: string }> {
    return prisma.trafficLog.create({
      data: {
        serviceType: 'REST',
        ipAddress: '203.0.113.1',
        startedAt: createdAt,
        endedAt: createdAt,
        connectionId: null,
        bytesTransferred: null,
        integrityHash: `test-hash-${randomUUID()}`,
        userId: null,
        createdAt,
      },
      select: { id: true },
    });
  }

  it('sirla_eksikse_401_doner', async () => {
    await request(app.getHttpServer())
      .post('/internal/traffic-logs/purge')
      .expect(401);
  });

  it('yanlis_sirla_401_doner', async () => {
    await request(app.getHttpServer())
      .post('/internal/traffic-logs/purge')
      .set('x-cron-secret', 'yanlis-sirla')
      .expect(401);
  });

  it('18_aydan_eski_satiri_siler_yeni_satiri_korur', async () => {
    const oldRow = await seedRow(new Date(Date.now() - CLEARLY_OLD_MS));
    const recentRow = await seedRow(new Date(Date.now() - CLEARLY_RECENT_MS));
    createdRowIds.push(oldRow.id, recentRow.id);

    const response = await request(app.getHttpServer())
      .post('/internal/traffic-logs/purge')
      .set('x-cron-secret', 'test-cron-secret')
      .expect(201);

    expect(
      (response.body as { deleted: number }).deleted,
    ).toBeGreaterThanOrEqual(1);

    const oldStillThere = await prisma.trafficLog.findUnique({
      where: { id: oldRow.id },
    });
    expect(oldStillThere).toBeNull();

    const recentStillThere = await prisma.trafficLog.findUnique({
      where: { id: recentRow.id },
    });
    expect(recentStillThere).not.toBeNull();
  });
});
