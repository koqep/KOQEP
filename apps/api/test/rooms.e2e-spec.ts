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

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

describe('Room creation (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let baseUrl: string;
  const createdRoomIds: string[] = [];
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
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
    if (createdRoomIds.length > 0) {
      // Message -> Room FK'si RESTRICT (M3 hard-delete istisnası sadece
      // ADR-0006 süpürmesinde uygulanıyor, testte elle aynı sırayı izliyoruz.
      await prisma.messageEdit.deleteMany({
        where: { message: { roomId: { in: createdRoomIds } } },
      });
      await prisma.message.deleteMany({
        where: { roomId: { in: createdRoomIds } },
      });
      await prisma.room.deleteMany({ where: { id: { in: createdRoomIds } } });
    }
    await app.close();
  });

  function connect(token: string): Socket {
    const socket = io(baseUrl, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
    });
    openSockets.push(socket);
    return socket;
  }

  async function createTestUser(): Promise<{
    userId: string;
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
    return { userId: user.id, accessToken };
  }

  it('kimlikli_kullanici_oda_olusturabilir', async () => {
    const { accessToken } = await createTestUser();
    const name = `oda-${randomUUID()}`;

    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name, description: 'test odasi' })
      .expect(201);

    const room = response.body as {
      id: string;
      name: string;
      description: string | null;
    };
    createdRoomIds.push(room.id);
    expect(room.name).toBe(name);
    expect(room.description).toBe('test odasi');
  });

  it('reddeder_kimliksiz_istegi', async () => {
    await request(app.getHttpServer())
      .post('/rooms')
      .send({ name: `oda-${randomUUID()}` })
      .expect(401);
  });

  it('reddeder_buyuk_kucuk_harf_farkli_ayni_ismi_409ile', async () => {
    const { accessToken } = await createTestUser();
    const name = `oda-${randomUUID()}`;

    const first = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);
    createdRoomIds.push((first.body as { id: string }).id);

    // Ayni kullanici gunde-1 limitine takilmamasi icin ikinci denemeyi
    // farkli bir kullaniciyla yapiyoruz - bu test case-insensitive
    // cakismayi dogruluyor, rate limiti degil.
    const { accessToken: otherToken } = await createTestUser();
    await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: name.toUpperCase() })
      .expect(409);
  });

  it('gunde_bir_odadan_fazlasini_ayni_kullanici_icin_engeller', async () => {
    const { accessToken } = await createTestUser();

    await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `oda-${randomUUID()}` })
      .expect(201)
      .then((response) => {
        createdRoomIds.push((response.body as { id: string }).id);
      });

    await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `oda-${randomUUID()}` })
      .expect(429);
  });

  it('olusturanin_zaten_bagli_soketi_yeni_odaya_hemen_katilir_ve_mesaj_alir', async () => {
    // RoomsService.createRoom'un socketRegistry.getSockets(userId) ile
    // ZATEN bağlı soketi yeni odaya kattığı kodu doğrudan doğruluyor -
    // oluşturucu odayı yaratmadan ÖNCE bağlanıyor.
    const creator = await createTestUser();
    const creatorSocket = connect(creator.accessToken);
    await waitForEvent(creatorSocket, 'ready');

    const name = `oda-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name })
      .expect(201);
    const room = response.body as { id: string; name: string };
    createdRoomIds.push(room.id);

    const content = `canli-mesaj-${randomUUID()}`;
    const receivedPromise = waitForEvent<{ content: string }>(
      creatorSocket,
      'message:new',
    );
    creatorSocket.emit('message:send', { content, roomName: room.name });

    const message = await receivedPromise;
    expect(message.content).toBe(content);
  }, 10000);

  it('oda_olusturulduktan_sonra_baglanan_baska_bir_kullanici_da_gercek_zamanli_alir', async () => {
    // handleConnection'ın eskiden sadece CORE_ROOM_NAMES sorguladığı,
    // kullanıcı odalarına hiç katılmadığı açığı doğrudan doğruluyor -
    // gözlemci odanın oluşmasından SONRA bağlanıyor (sayfa yenileme/yeniden
    // bağlanma senaryosu), "tüm aktif odalar"a katılmalı.
    const creator = await createTestUser();
    const observer = await createTestUser();

    const name = `oda-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name })
      .expect(201);
    const room = response.body as { id: string; name: string };
    createdRoomIds.push(room.id);

    const observerSocket = connect(observer.accessToken);
    await waitForEvent(observerSocket, 'ready');

    const content = `sonradan-baglanan-${randomUUID()}`;
    const receivedPromise = waitForEvent<{ content: string }>(
      observerSocket,
      'message:new',
    );
    observerSocket.emit('message:send', { content, roomName: room.name });

    const message = await receivedPromise;
    expect(message.content).toBe(content);
  }, 10000);
});
