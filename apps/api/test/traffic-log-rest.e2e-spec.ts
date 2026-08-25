import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import * as argon2 from 'argon2';
import { TrafficLog } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { randomTestIp } from './support/random-test-ip';

// M6b Slice C: TrafficLogMiddleware'in gerçek uçtan uca kanıtı - özellikle
// middleware'i (interceptor değil) seçmenin gerekçesi olan "Guard'ın
// reddettiği istek de kayıt edilir" davranışı. Yazma ateşle-unut olduğu
// için (bkz. traffic-log.middleware.ts) HTTP yanıtı dönünce satırın DB'ye
// gerçekten yazılmış olması garanti değil - waitForTrafficLogRow kısa bir
// pencerede POLL ediyor (kör bir sleep değil). Jest e2e dosyaları PARALEL
// koşabiliyor - her test kendi isteğine `trackedTestIp()`'in (support/
// random-test-ip.ts, M6b Slice D'de gerçek bir çarpışma bulunup geniş
// bir alana çıkarıldı) ürettiği benzersiz bir X-Forwarded-For veriyor ve
// TÜM DB sorgularını o IP'ye göre daraltıyor.
describe('TrafficLog REST middleware (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  const createdUserIds: string[] = [];
  const usedIpAddresses: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    if (usedIpAddresses.length > 0) {
      await prisma.trafficLog.deleteMany({
        where: { ipAddress: { in: usedIpAddresses } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await app.close();
  });

  function trackedTestIp(): string {
    const ip = randomTestIp();
    usedIpAddresses.push(ip);
    return ip;
  }

  async function createTestUser(): Promise<{
    userId: string;
    email: string;
    password: string;
    accessToken: string;
  }> {
    const email = `traffic-log-${randomUUID()}@koqep.local`;
    const username = `traffic-log-${randomUUID()}`;
    const password = 'CorrectHorseBattery1!';
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash,
        emailVerifiedAt: new Date(),
      },
    });
    createdUserIds.push(user.id);
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { userId: user.id, email, password, accessToken };
  }

  async function waitForTrafficLogRow(ipAddress: string): Promise<TrafficLog> {
    const maxAttempts = 20;
    const delayMs = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const row = await prisma.trafficLog.findFirst({
        where: { ipAddress },
        orderBy: { createdAt: 'desc' },
      });
      if (row) {
        return row;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error('Beklenen TrafficLog satırı zaman aşımında oluşmadı.');
  }

  it('basarili_public_istek_trafficlog_satiri_uretir', async () => {
    const { email, password } = await createTestUser();
    const ip = trackedTestIp();

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-Forwarded-For', ip)
      .send({ email, password })
      .expect(201);

    // login public - request.user hiç set edilmiyor (JwtAuthGuard hiç
    // çalışmıyor), bu yüzden bu isteğin satırı userId:null taşımalı.
    const row = await waitForTrafficLogRow(ip);

    expect(row.ipAddress).toBe(ip);
    expect(row.serviceType).toBe('REST');
    expect(row.userId).toBeNull();
    expect(row.integrityHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.startedAt).not.toBeNull();
    expect(row.endedAt).not.toBeNull();
  });

  it('guard_reddettigi_istek_de_kayit_uretir_userId_null', async () => {
    const ip = trackedTestIp();

    await request(app.getHttpServer())
      .get('/me/export')
      .set('X-Forwarded-For', ip)
      .expect(401);

    const row = await waitForTrafficLogRow(ip);

    expect(row.userId).toBeNull();
    expect(row.serviceType).toBe('REST');
  });

  it('kimlik_dogrulanmis_istekte_userId_dolu', async () => {
    const { userId, accessToken } = await createTestUser();
    const ip = trackedTestIp();

    await request(app.getHttpServer())
      .get('/me/export')
      .set('X-Forwarded-For', ip)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const row = await waitForTrafficLogRow(ip);

    expect(row.userId).toBe(userId);
    expect(row.serviceType).toBe('REST');
  });

  it('health_route_trafficlog_satiri_uretmez', async () => {
    const ip = trackedTestIp();

    await request(app.getHttpServer())
      .get('/health')
      .set('X-Forwarded-For', ip)
      .expect(200);

    // Ateşle-unut yazma gerçekten OLUŞMADIĞI için (route hariç tutuldu)
    // burada bekleyecek bir satır yok - benzersiz IP'ye ait HİÇ satır
    // oluşmadığını kısa bir pencere sonunda doğrulamak yeterli.
    await new Promise((resolve) => setTimeout(resolve, 200));
    const row = await prisma.trafficLog.findFirst({ where: { ipAddress: ip } });

    expect(row).toBeNull();
  });
});
