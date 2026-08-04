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
import {
  XP_PER_LEVEL,
  MESSAGE_SENT_XP,
} from './../src/services/reputation.service';
import { buildEmailServiceMock } from './support/email-service-mock';

describe('Invites: kazanım + görüntüleme (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let messagesService: MessagesService;

  beforeAll(async () => {
    // Bu dosyanın odağı /invites, e-posta gönderimi değil - ama aşağıdaki
    // testlerden biri gerçek /auth/signup'ı tetikliyor, o da EmailService'e
    // dokunuyor (bkz. support/email-service-mock.ts).
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
    await app.close();
  });

  // M4 Slice B'de manuel oluşturma kaldırıldığı için artık taze bir "davetçi"
  // yaratmak, kullanıcıyı bir seviye atlamaya bir mesaj uzaklıkta seed edip
  // gerçek bir mesaj göndermek demek - bu, üretilen kodun gerçek
  // grantInvites yolundan geldiğini garanti eder (elle prisma.invite.create
  // DEĞİL).
  async function createLeveledUpInviter(): Promise<{
    userId: string;
    accessToken: string;
  }> {
    const email = `inviter-${randomUUID()}@koqep.local`;
    const username = `inviter-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: 'test-not-a-real-hash',
        emailVerifiedAt: new Date(),
        totalXp: XP_PER_LEVEL - MESSAGE_SENT_XP,
        level: 0,
      },
    });
    await messagesService.sendMessage(
      user.id,
      CORE_ROOM_NAMES[0],
      `seviye-atlama-${randomUUID()}`,
    );
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { userId: user.id, accessToken };
  }

  it('seviye_atlayinca_kazanilan_kod_gercek_signupta_kullanilabilir', async () => {
    const issuer = await createLeveledUpInviter();

    const invite = await prisma.invite.findFirst({
      where: { issuedById: issuer.userId, usedAt: null },
    });
    expect(invite).not.toBeNull();

    const newUserEmail = `invited-${randomUUID()}@koqep.local`;
    await request(app.getHttpServer())
      .post('/auth/signup')
      .send({
        inviteCode: invite?.code,
        email: newUserEmail,
        username: `invited-${randomUUID()}`,
        password: 'a-strong-password',
      })
      .expect(201);

    const newUser = await prisma.user.findUnique({
      where: { email: newUserEmail },
    });
    expect(newUser?.inviterId).toBe(issuer.userId);
  });

  describe('GET /invites', () => {
    it('reddeder_kimliksiz_istegi', async () => {
      await request(app.getHttpServer()).get('/invites').expect(401);
    });

    it('henuz_seviye_atlamamis_kullanici_icin_bos_liste_doner', async () => {
      const email = `fresh-${randomUUID()}@koqep.local`;
      const user = await prisma.user.create({
        data: {
          email,
          username: `fresh-${randomUUID()}`,
          passwordHash: 'test-not-a-real-hash',
        },
      });
      const accessToken = await jwtService.signAsync({
        sub: user.id,
        email: user.email,
      });

      const response = await request(app.getHttpServer())
        .get('/invites')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });

    it('kazanilan_daveti_kod_ve_durumuyla_listeler', async () => {
      const issuer = await createLeveledUpInviter();

      const response = await request(app.getHttpServer())
        .get('/invites')
        .set('Authorization', `Bearer ${issuer.accessToken}`)
        .expect(200);

      expect(response.body).toHaveLength(1);
      const [dto] = response.body as {
        code: string;
        createdAt: string;
        usedAt: string | null;
      }[];
      expect(typeof dto.code).toBe('string');
      expect(dto.code.length).toBeGreaterThanOrEqual(16);
      expect(dto.usedAt).toBeNull();
      expect(dto).not.toHaveProperty('usedById');
    });
  });
});
