import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import request from 'supertest';
import { App } from 'supertest/types';
import { getRealClientIp } from './../src/services/client-ip.util';

@Controller('throttle-test')
class ThrottleTestController {
  @Get()
  ping(): { ok: true } {
    return { ok: true };
  }
}

// M6b Slice A: gerçek AppModule'ün limiti (100/60s) bu testi hızlıca
// tetiklemek için fazla yüksek - AYRI, minimal bir test modülü, AYNI
// getTracker mantığıyla ama düşük bir limitle kuruluyor. Amaç: getTracker
// entegrasyonunun GERÇEKTEN her istemciye kendi sayacını verdiğini
// kanıtlamak - "trust proxy hiç yoktu, tüm istemciler tek havuzu
// paylaşıyordu" bulgusunun (docs/milestones/M6b-traffic-log-5651.md)
// regresyon testi.
@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 2,
        getTracker: (req: {
          headers?: Record<string, string | string[] | undefined>;
          socket?: { remoteAddress?: string };
        }) =>
          getRealClientIp(
            req.headers?.['x-forwarded-for'],
            req.headers?.['cf-connecting-ip'],
            req.socket?.remoteAddress,
          ),
      },
    ]),
  ],
  controllers: [ThrottleTestController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
class ThrottleTestModule {}

describe("Rate limit tracker gerçek istemci IP'sine göre çalışıyor (e2e)", () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottleTestModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('farkli_x_forwarded_for_degerleri_bagimsiz_sayaclara_duser', async () => {
    const agent = request(app.getHttpServer());

    // IP A: limit 2 - ilk iki istek geçer, üçüncü 429 almalı.
    await agent
      .get('/throttle-test')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(200);
    await agent
      .get('/throttle-test')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(200);
    await agent
      .get('/throttle-test')
      .set('X-Forwarded-For', '203.0.113.10')
      .expect(429);

    // IP B: FARKLI istemci - hâlâ kendi TAZE sayacına sahip olmalı, IP A
    // tükendiği için etkilenmemeli. trust proxy yokken (eski davranış)
    // req.ip Render'ın TEK LB IP'sini görürdü - bu durumda IP B de AYNI
    // (tükenmiş) sayaca düşer, bu istek 429 alırdı.
    await agent
      .get('/throttle-test')
      .set('X-Forwarded-For', '203.0.113.20')
      .expect(200);
  });
});
