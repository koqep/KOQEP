import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { DEV_ROOM_NAME } from './../src/db/dev-seed.constants';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

function neverReceives(
  socket: Socket,
  event: string,
  ms = 500,
): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(true), ms);
    socket.once(event, () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

describe('Block-user (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let baseUrl: string;
  const openSockets: Socket[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer() as Server;
    const address = server.address();
    if (typeof address !== 'object' || address === null) {
      throw new Error('Beklenmeyen sunucu adresi formatı.');
    }
    baseUrl = `http://localhost:${address.port}`;

    prisma = moduleFixture.get(PrismaService);
    await prisma.room.upsert({
      where: { name: DEV_ROOM_NAME },
      update: {},
      create: { name: DEV_ROOM_NAME },
    });
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    await app.close();
  });

  function connectSocket(token: string): Socket {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    openSockets.push(socket);
    return socket;
  }

  async function signUpFreshUser(): Promise<{
    email: string;
    accessToken: string;
  }> {
    const issuer = await prisma.user.create({
      data: {
        email: `issuer-${randomUUID()}@koqep.local`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    const code = `INVITE-${randomUUID()}`;
    await prisma.invite.create({ data: { code, issuedById: issuer.id } });

    const email = `user-${randomUUID()}@koqep.local`;
    const response = await request(app.getHttpServer())
      .post('/auth/signup')
      .send({ inviteCode: code, email, password: 'a-strong-password' })
      .expect(201);

    const body = response.body as { accessToken: string };
    return { email, accessToken: body.accessToken };
  }

  it('reddeder_kendini_engellemeyi', async () => {
    const a = await signUpFreshUser();

    await request(app.getHttpServer())
      .post('/users/block')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ email: a.email })
      .expect(409);
  });

  it('reddeder_bulunamayan_e_postayi', async () => {
    const a = await signUpFreshUser();

    await request(app.getHttpServer())
      .post('/users/block')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ email: `yok-${randomUUID()}@koqep.local` })
      .expect(404);
  });

  it('tam_akis_gecmis_ve_gercek_zamanli_filtreleme_ve_engel_kaldirma', async () => {
    const a = await signUpFreshUser();
    const b = await signUpFreshUser();
    const c = await signUpFreshUser();

    const socketA = connectSocket(a.accessToken);
    const socketB = connectSocket(b.accessToken);
    const socketC = connectSocket(c.accessToken);
    await Promise.all([
      waitForEvent(socketA, 'ready'),
      waitForEvent(socketB, 'ready'),
      waitForEvent(socketC, 'ready'),
    ]);

    // B bir mesaj gönderir (henüz engellenmeden önce) — geçmişte görünecek.
    const beforeBlockContent = `once-${randomUUID()}`;
    const beforeBlockReceived = waitForEvent<{ content: string }>(
      socketC,
      'message:new',
    );
    socketB.emit('message:send', { content: beforeBlockContent });
    await beforeBlockReceived;

    // A, B'yi engeller.
    await request(app.getHttpServer())
      .post('/users/block')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ email: b.email })
      .expect(201);

    // A'nın geçmişinde B'nin mesajı artık yok; C için hâlâ var.
    const historyForA = await request(app.getHttpServer())
      .get(`/rooms/${DEV_ROOM_NAME}/messages`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    const historyForABodyContents = (
      historyForA.body as { messages: { content: string }[] }
    ).messages.map((m) => m.content);
    expect(historyForABodyContents).not.toContain(beforeBlockContent);

    const historyForC = await request(app.getHttpServer())
      .get(`/rooms/${DEV_ROOM_NAME}/messages`)
      .set('Authorization', `Bearer ${c.accessToken}`)
      .expect(200);
    const historyForCBodyContents = (
      historyForC.body as { messages: { content: string }[] }
    ).messages.map((m) => m.content);
    expect(historyForCBodyContents).toContain(beforeBlockContent);

    // B yeni bir mesaj gönderir — A'ya asla ulaşmamalı, C'ye ulaşmalı.
    const afterBlockContent = `sonra-${randomUUID()}`;
    const aNeverGetsIt = neverReceives(socketA, 'message:new');
    const cReceivesIt = waitForEvent<{ content: string }>(
      socketC,
      'message:new',
    );
    socketB.emit('message:send', { content: afterBlockContent });

    const [aTimedOut, cMessage] = await Promise.all([
      aNeverGetsIt,
      cReceivesIt,
    ]);
    expect(aTimedOut).toBe(true);
    expect(cMessage.content).toBe(afterBlockContent);

    // A engeli kaldırır — B'nin sonraki mesajı tekrar ulaşır.
    await request(app.getHttpServer())
      .post('/users/unblock')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ email: b.email })
      .expect(201);

    const afterUnblockContent = `unblock-${randomUUID()}`;
    const aReceivesAgain = waitForEvent<{ content: string }>(
      socketA,
      'message:new',
    );
    socketB.emit('message:send', { content: afterUnblockContent });
    const receivedAgain = await aReceivesAgain;
    expect(receivedAgain.content).toBe(afterUnblockContent);
  }, 15000);
});
