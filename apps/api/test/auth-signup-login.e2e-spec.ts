import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';

describe('Auth signup/login/refresh/logout (e2e)', () => {
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

  async function seedInvite(): Promise<{ code: string; issuerId: string }> {
    const issuer = await prisma.user.create({
      data: {
        email: `issuer-${randomUUID()}@koqep.local`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    const code = `INVITE-${randomUUID()}`;
    await prisma.invite.create({ data: { code, issuedById: issuer.id } });
    return { code, issuerId: issuer.id };
  }

  it('kayit_daveti_talep_eder_ve_dogru_davetciyi_baglar', async () => {
    const { code, issuerId } = await seedInvite();
    const email = `user-${randomUUID()}@koqep.local`;

    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, password: 'a-strong-password' })
      .expect(201);

    const body = response.body as {
      accessToken: string;
      refreshToken: string;
    };
    expect(typeof body.accessToken).toBe('string');
    expect(typeof body.refreshToken).toBe('string');

    const createdUser = await prisma.user.findUniqueOrThrow({
      where: { email },
    });
    expect(createdUser.inviterId).toBe(issuerId);

    const invite = await prisma.invite.findUniqueOrThrow({
      where: { code },
    });
    expect(invite.usedById).toBe(createdUser.id);
  });

  it('reddeder_tekrar_kullanilan_davet_kodunu', async () => {
    const { code } = await seedInvite();

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: `user-${randomUUID()}@koqep.local`,
        password: 'a-strong-password',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: code,
        email: `user-${randomUUID()}@koqep.local`,
        password: 'a-strong-password',
      })
      .expect(409);
  });

  it('giris_yapar_dogru_sifreyle_ve_reddeder_yanlisini', async () => {
    const { code } = await seedInvite();
    const email = `user-${randomUUID()}@koqep.local`;
    const password = 'a-strong-password';

    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, password })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
  });

  it('yeniler_refresh_tokeni_ve_eskisini_gecersiz_kilar', async () => {
    const { code } = await seedInvite();
    const email = `user-${randomUUID()}@koqep.local`;

    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, password: 'a-strong-password' })
      .expect(201);

    const { refreshToken } = signupResponse.body as { refreshToken: string };

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(201);

    const newTokens = refreshResponse.body as { refreshToken: string };
    expect(newTokens.refreshToken).not.toBe(refreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });

  it('cikis_yapinca_refresh_tokeni_gecersiz_kilar', async () => {
    const { code } = await seedInvite();
    const email = `user-${randomUUID()}@koqep.local`;

    const signupResponse = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, password: 'a-strong-password' })
      .expect(201);

    const { refreshToken } = signupResponse.body as { refreshToken: string };

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken })
      .expect(401);
  });
});
