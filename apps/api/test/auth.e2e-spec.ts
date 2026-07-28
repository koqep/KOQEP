import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { DEV_USER_EMAIL } from './../src/db/dev-seed.constants';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwt: JwtService;
  let seededUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwt = moduleFixture.get(JwtService);

    const user = await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: { email: DEV_USER_EMAIL },
    });
    seededUserId = user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('doner_calisan_bir_erisim_tokeni_seed_kullanici_icin', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/dev-login')
      .expect(201);

    const body = response.body as { accessToken: string };
    expect(typeof body.accessToken).toBe('string');

    const payload = jwt.verify<{ sub: string; email: string }>(
      body.accessToken,
    );
    expect(payload.sub).toBe(seededUserId);
    expect(payload.email).toBe(DEV_USER_EMAIL);
  });
});
