import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { randomUUID } from 'crypto';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';

describe('Message edit history access control (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let roomId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
    const room = await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
    roomId = room.id;
  });

  afterAll(async () => {
    await app.close();
  });

  async function signUpFreshUser(): Promise<{
    id: string;
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
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { id: user.id, email, accessToken: body.accessToken };
  }

  async function createMessageWithEditHistory(authorId: string): Promise<{
    messageId: string;
    previousContent: string;
  }> {
    const previousContent = `ilk-hal-${randomUUID()}`;
    const message = await prisma.message.create({
      data: { content: `guncel-hal-${randomUUID()}`, roomId, authorId },
    });
    await prisma.messageEdit.create({
      data: { messageId: message.id, previousContent },
    });
    return { messageId: message.id, previousContent };
  }

  it('yazar_kendi_mesajinin_duzenleme_gecmisini_gorebilir', async () => {
    const author = await signUpFreshUser();
    const { messageId, previousContent } = await createMessageWithEditHistory(
      author.id,
    );

    const response = await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/edits`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(200);

    const edits = response.body as { previousContent: string }[];
    expect(edits.map((e) => e.previousContent)).toContain(previousContent);
  });

  it('moderator_baskasinin_mesajinin_gecmisini_gorebilir', async () => {
    const author = await signUpFreshUser();
    const moderator = await signUpFreshUser();
    await prisma.user.update({
      where: { id: moderator.id },
      data: { role: 'moderator' },
    });
    const { messageId, previousContent } = await createMessageWithEditHistory(
      author.id,
    );

    const response = await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/edits`)
      .set('Authorization', `Bearer ${moderator.accessToken}`)
      .expect(200);

    const edits = response.body as { previousContent: string }[];
    expect(edits.map((e) => e.previousContent)).toContain(previousContent);
  });

  it('ne_yazar_ne_moderator_olan_kullanici_reddedilir', async () => {
    const author = await signUpFreshUser();
    const bystander = await signUpFreshUser();
    const { messageId } = await createMessageWithEditHistory(author.id);

    await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${messageId}/edits`)
      .set('Authorization', `Bearer ${bystander.accessToken}`)
      .expect(403);
  });

  it('bilinmeyen_mesaj_icin_404_doner', async () => {
    const author = await signUpFreshUser();

    await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages/${randomUUID()}/edits`)
      .set('Authorization', `Bearer ${author.accessToken}`)
      .expect(404);
  });
});
