import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { AuthService } from './../src/services/auth.service';
import { DEV_USER_EMAIL, DEV_ROOM_NAME } from './../src/db/dev-seed.constants';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('Messages Gateway (e2e)', () => {
  let app: INestApplication;
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
    const authService = moduleFixture.get(AuthService);

    await prisma.user.upsert({
      where: { email: DEV_USER_EMAIL },
      update: {},
      create: { email: DEV_USER_EMAIL, passwordHash: 'test-not-a-real-hash' },
    });
    await prisma.room.upsert({
      where: { name: DEV_ROOM_NAME },
      update: {},
      create: { name: DEV_ROOM_NAME },
    });

    const issued = await authService.issueDevLoginToken();
    accessToken = issued.accessToken;
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    if (createdMessageIds.length > 0) {
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
});
