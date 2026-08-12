import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { EmailService } from './../src/services/email.service';
import { MessagesService } from './../src/services/messages.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';
import { buildEmailServiceMock } from './support/email-service-mock';

describe('GET /me/export (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let messagesService: MessagesService;
  const createdUserIds: string[] = [];
  const createdMessageIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(buildEmailServiceMock())
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    jwtService = moduleFixture.get(JwtService);
    messagesService = moduleFixture.get(MessagesService);

    for (const name of CORE_ROOM_NAMES) {
      await prisma.room.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
  });

  afterAll(async () => {
    // sendMessage PAYLAŞILAN #general odasına gerçek bir Message satırı
    // yazıyor - temizlenmezse her koşum #general'i kalıcı kirletir
    // (invites.e2e-spec.ts'te de aynı desen, gerçek bir CI/local hatasıydı).
    if (createdMessageIds.length > 0) {
      await prisma.reputationEvent.deleteMany({
        where: { sourceMessageId: { in: createdMessageIds } },
      });
      await prisma.message.deleteMany({
        where: { id: { in: createdMessageIds } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.reputationEvent.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
      await prisma.invite.deleteMany({
        where: { issuedById: { in: createdUserIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
    }
    await app.close();
  });

  async function createTestUser(): Promise<{
    userId: string;
    accessToken: string;
  }> {
    const email = `export-${randomUUID()}@koqep.local`;
    const username = `export-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: 'test-not-a-real-hash',
        emailVerifiedAt: new Date(),
      },
    });
    createdUserIds.push(user.id);
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { userId: user.id, accessToken };
  }

  it('reddeder_kimliksiz_istegi', async () => {
    await request(app.getHttpServer()).get('/me/export').expect(401);
  });

  it('hic_verisi_olmayan_kullanici_icin_bos_dizilerle_dogru_profili_doner', async () => {
    const { userId, accessToken } = await createTestUser();

    const response = await request(app.getHttpServer())
      .get('/me/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      profile: { id: string };
      messages: unknown[];
      invites: unknown[];
      reputationEvents: unknown[];
    };
    expect(body.profile.id).toBe(userId);
    expect(body.messages).toEqual([]);
    expect(body.invites).toEqual([]);
    expect(body.reputationEvents).toEqual([]);
  });

  it('kendi_mesajini_davetini_ve_itibar_olayini_dogru_alanlarla_listeler_sirlari_disarida_birakir', async () => {
    const { userId, accessToken } = await createTestUser();

    const content = `disa-aktarma-${randomUUID()}`;
    const message = await messagesService.sendMessage(
      userId,
      CORE_ROOM_NAMES[0],
      content,
    );
    createdMessageIds.push(message.id);

    const inviteCode = randomUUID();
    await prisma.invite.create({
      data: { code: inviteCode, issuedById: userId },
    });

    const response = await request(app.getHttpServer())
      .get('/me/export')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const body = response.body as {
      profile: Record<string, unknown>;
      messages: { id: string; content: string; roomName: string }[];
      invites: { code: string; usedAt: string | null }[];
      reputationEvents: { actionType: string; amount: number }[];
    };

    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe(content);
    expect(body.messages[0].roomName).toBe(CORE_ROOM_NAMES[0]);

    expect(body.invites).toHaveLength(1);
    expect(body.invites[0].code).toBe(inviteCode);
    expect(body.invites[0]).not.toHaveProperty('usedById');

    expect(body.reputationEvents.length).toBeGreaterThanOrEqual(1);

    expect(body.profile).not.toHaveProperty('passwordHash');
    expect(body.profile).not.toHaveProperty('totpSecret');
    expect(body.profile).not.toHaveProperty('inviterId');
  });
});
