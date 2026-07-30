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
import { DEV_USER_EMAIL } from './../src/db/dev-seed.constants';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('Messages Gateway (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let accessToken: string;
  let baseUrl: string;
  const createdMessageIds: string[] = [];
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
    const jwtService = moduleFixture.get(JwtService);

    const user = await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: { email: DEV_USER_EMAIL, passwordHash: 'test-not-a-real-hash' },
    });
    for (const name of CORE_ROOM_NAMES) {
      await prisma.room.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }

    accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
  });

  async function createOtherUserToken(): Promise<string> {
    const jwtService = app.get(JwtService);
    const other = await prisma.user.create({
      data: {
        email: `other-${randomUUID()}@koqep.local`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    return jwtService.signAsync({ sub: other.id, email: other.email });
  }

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    if (createdMessageIds.length > 0) {
      // MessageEdit -> Message FK'si ON DELETE RESTRICT - mesajdan once
      // onun duzenleme gecmisi silinmeli (M2 Slice B).
      await prisma.messageEdit.deleteMany({
        where: { messageId: { in: createdMessageIds } },
      });
      await prisma.message.deleteMany({
        where: { id: { in: createdMessageIds } },
      });
    }
    await app.close();
  });

  function connect(token?: string): Socket {
    const socket = io(baseUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
    });
    openSockets.push(socket);
    return socket;
  }

  it('gecersiz_token_ile_baglanti_reddedilir', async () => {
    const client = connect('gecersiz-bir-token');
    await waitForEvent(client, 'disconnect');
  }, 10000);

  it('mesaj_gonderilince_diger_baglanti_gercek_zamanli_alir_ve_db_de_kalicidir', async () => {
    const sender = connect(accessToken);
    const receiver = connect(accessToken);

    await Promise.all([
      waitForEvent(sender, 'ready'),
      waitForEvent(receiver, 'ready'),
    ]);

    const content = `e2e-mesaj-${randomUUID()}`;
    const receivedPromise = waitForEvent<{ id: string; content: string }>(
      receiver,
      'message:new',
    );
    sender.emit('message:send', { content });

    const message = await receivedPromise;
    expect(message.content).toBe(content);
    createdMessageIds.push(message.id);

    const row = await prisma.message.findUnique({
      where: { id: message.id },
    });
    expect(row).not.toBeNull();
    expect(row?.content).toBe(content);
  }, 10000);

  it('roomName_belirtilince_dogru_odaya_gider_diger_odanin_gecmisine_sizmaz', async () => {
    const sender = connect(accessToken);
    const receiver = connect(accessToken);

    await Promise.all([
      waitForEvent(sender, 'ready'),
      waitForEvent(receiver, 'ready'),
    ]);

    const content = `meta-mesaj-${randomUUID()}`;
    const receivedPromise = waitForEvent<{ id: string; content: string }>(
      receiver,
      'message:new',
    );
    sender.emit('message:send', { content, roomName: CORE_ROOM_NAMES[1] });

    const message = await receivedPromise;
    expect(message.content).toBe(content);
    createdMessageIds.push(message.id);

    const metaHistory = await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[1]}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const metaContents = (
      metaHistory.body as { messages: { content: string }[] }
    ).messages.map((m) => m.content);
    expect(metaContents).toContain(content);

    const generalHistory = await request(app.getHttpServer())
      .get(`/rooms/${CORE_ROOM_NAMES[0]}/messages`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const generalContents = (
      generalHistory.body as { messages: { content: string }[] }
    ).messages.map((m) => m.content);
    expect(generalContents).not.toContain(content);
  }, 10000);

  it('yazar_mesajini_duzenleyince_diger_baglanti_gercek_zamanli_guncellenmis_halini_alir', async () => {
    const sender = connect(accessToken);
    const receiver = connect(accessToken);

    await Promise.all([
      waitForEvent(sender, 'ready'),
      waitForEvent(receiver, 'ready'),
    ]);

    const originalContent = `duzenlenecek-${randomUUID()}`;
    const createdPromise = waitForEvent<{ id: string; content: string }>(
      receiver,
      'message:new',
    );
    sender.emit('message:send', { content: originalContent });
    const created = await createdPromise;
    createdMessageIds.push(created.id);

    const editedContent = `duzenlendi-${randomUUID()}`;
    const updatedPromise = waitForEvent<{ id: string; content: string }>(
      receiver,
      'message:updated',
    );
    sender.emit('message:edit', {
      messageId: created.id,
      content: editedContent,
    });

    const updated = await updatedPromise;
    expect(updated.id).toBe(created.id);
    expect(updated.content).toBe(editedContent);

    const row = await prisma.message.findUnique({
      where: { id: created.id },
    });
    expect(row?.content).toBe(editedContent);

    const editRows = await prisma.messageEdit.findMany({
      where: { messageId: created.id },
    });
    expect(editRows).toHaveLength(1);
    expect(editRows[0].previousContent).toBe(originalContent);
  }, 10000);

  it('baskasinin_mesajini_duzenleme_denemesi_sessizce_yoksayilir', async () => {
    const sender = connect(accessToken);
    const createdPromise = waitForEvent<{ id: string; content: string }>(
      sender,
      'message:new',
    );
    await waitForEvent(sender, 'ready');

    const originalContent = `sahibi-korunacak-${randomUUID()}`;
    sender.emit('message:send', { content: originalContent });
    const created = await createdPromise;
    createdMessageIds.push(created.id);

    const otherToken = await createOtherUserToken();
    const intruder = connect(otherToken);
    await waitForEvent(intruder, 'ready');

    const neverUpdated = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(true), 500);
      intruder.once('message:updated', () => {
        clearTimeout(timer);
        resolve(false);
      });
    });
    intruder.emit('message:edit', {
      messageId: created.id,
      content: 'baskasi-yazdi',
    });

    expect(await neverUpdated).toBe(true);

    const row = await prisma.message.findUnique({
      where: { id: created.id },
    });
    expect(row?.content).toBe(originalContent);
  }, 10000);
});
