import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

describe('Invite issuance + rate limiting (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterAll(async () => {
    await app.close();
  });

  async function signUpFreshUser(): Promise<{
    email: string;
    accessToken: string;
  }> {
    const issuer = await prisma.user.create({
      data: {
        email: `issuer-${randomUUID()}@koqep.local`,
        username: `issuer-${randomUUID()}`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    const code = `INVITE-${randomUUID()}`;
    await prisma.invite.create({ data: { code, issuedById: issuer.id } });

    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email,
        username,
        password: 'a-strong-password',
      })
      .expect(201);

    const body = response.body as { accessToken: string };
    return { email, accessToken: body.accessToken };
  }

  it('gecerli_bir_davet_kodu_uretir_ve_gercek_signup_ile_kullanilabilir', async () => {
    const issuer = await signUpFreshUser();

    const response = await request(app.getHttpServer())
      .post('/invites')
      .set('Authorization', `Bearer ${issuer.accessToken}`)
      .expect(201);

    const { code } = response.body as { code: string };
    expect(typeof code).toBe('string');
    expect(code.length).toBeGreaterThanOrEqual(16);

    const newUserEmail = `invited-${randomUUID()}@koqep.local`;
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: newUserEmail,
        username: `invited-${randomUUID()}`,
        password: 'a-strong-password',
      })
      .expect(201);
  });

  it('reddeder_kimliksiz_istegi', async () => {
    await request(app.getHttpServer()).post('/invites').expect(401);
  });

  it('saatte_bes_davetten_fazlasini_ayni_kullanici_icin_engeller', async () => {
    const issuer = await signUpFreshUser();
    const authHeader = { Authorization: `Bearer ${issuer.accessToken}` };

    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/invites')
        .set(authHeader)
        .expect(201);
    }

    await request(app.getHttpServer())
      .post('/invites')
      .set(authHeader)
      .expect(429);
  });
});
