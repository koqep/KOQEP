import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';

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
  let jwtService: JwtService;
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
    jwtService = moduleFixture.get(JwtService);
    await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
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

  // Bu dosya signup/e-posta doğrulama davranışını test etmiyor, sadece
  // kimlik doğrulanmış test kullanıcılarına ihtiyaç duyuyor - gerçek
  // /auth/signup + /auth/verify-email + /auth/login akışından geçmek
  // yerine doğrudan doğrulanmış bir kullanıcı oluşturup token imzalıyoruz
  // (messages-gateway.e2e-spec.ts'in dev-user deseniyle aynı, M2.5 Slice B).
  async function createTestUser(): Promise<{
    email: string;
    username: string;
    accessToken: string;
  }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const user = await prisma.user.create({
      data: {
        email,
        username,
        passwordHash: 'test-not-a-real-hash',
        emailVerifiedAt: new Date(),
      },
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { email, username, accessToken };
  }

  it('doner_kendi_email_kullanici_adi_rolunu_seviyesini_ve_xpsini', async () => {
    const a = await createTestUser();

    const response = await request(app.getHttpServer())
      .get('/users/me')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);

    expect(response.body).toEqual({
      email: a.email,
      username: a.username,
      role: 'user',
      level: 0,
      totalXp: 0,
      mutedUntil: null,
    });
  });

  it('reddeder_kendini_engellemeyi', async () => {
    const a = await createTestUser();

    await request(app.getHttpServer())
      .post('/users/block')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ email: a.email })
      .expect(409);
  });

  it('reddeder_bulunamayan_e_postayi', async () => {
    const a = await createTestUser();

    await request(app.getHttpServer())
      .post('/users/block')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ email: `yok-${randomUUID()}@koqep.local` })
      .expect(404);
  });

  it('tam_akis_gecmis_ve_gercek_zamanli_filtreleme_ve_engel_kaldirma', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const c = await createTestUser();

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
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages`)
      .set('Authorization', `Bearer ${a.accessToken}`)
      .expect(200);
    const historyForABodyContents = (
      historyForA.body as { messages: { content: string }[] }
    ).messages.map((m) => m.content);
    expect(historyForABodyContents).not.toContain(beforeBlockContent);

    const historyForC = await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages`)
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
