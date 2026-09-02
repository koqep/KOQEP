import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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

  it('odaya_hic_uye_olmamis_ilgisiz_bir_gozlemci_gercek_zamanli_yayin_ALMAZ', async () => {
    // M7a Slice B (ADR-0009): bu testin ESKİ hali tam tersini kanıtlıyordu -
    // "tüm aktif odalar"a otomatik katılma açığının kasıtlı kanıtıydı
    // (handleConnection'ın eskiden sadece CORE_ROOM_NAMES sorguladığı M3
    // açığı). Üyelik modeliyle bu davranış artık BİLEREK TERS ÇEVRİLDİ -
    // ilgisiz bir gözlemci (hiç üye olmadığı) bir odada olup biteni
    // görmemeli. Mesajı GÖNDEREN kişi de gözlemcinin kendisi - erişim
    // kontrolü hâlâ yok (herhangi bir authed kullanıcı isimle yazabilir,
    // ADR-0009), ama kendi mesajını KENDİ ekranında görmüyor çünkü join'li
    // değil (bilerek kabul edilmiş, ADR-0009'da belgelenen kenar durum).
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
    const neverReceivedPromise = neverReceives(observerSocket, 'message:new');
    observerSocket.emit('message:send', { content, roomName: room.name });

    expect(await neverReceivedPromise).toBe(true);

    // Mesaj GERÇEKTEN oluştu (erişim kontrolü yok, ADR-0009) - sadece
    // gönderenin KENDİ ekranına gerçek zamanlı ulaşmadı. Odayla birlikte
    // afterAll'da temizleniyor (createdRoomIds), ayrı bir izlemeye gerek yok.
    const row = await prisma.message.findFirst({ where: { content } });
    expect(row).not.toBeNull();
  }, 10000);

  it('odaya_gercekten_uye_olan_bir_kullanici_gercek_zamanli_yayin_ALIR', async () => {
    // Yukarıdaki testin simetrik kanıtı - POST /rooms/:id/join ile GERÇEKTEN
    // üye olan bir kullanıcı, üyelik-scoped handleConnection'la birlikte
    // yayını gerçekten alıyor.
    const creator = await createTestUser();
    const member = await createTestUser();

    const name = `oda-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name })
      .expect(201);
    const room = response.body as { id: string; name: string };
    createdRoomIds.push(room.id);

    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .expect(201);

    const memberSocket = connect(member.accessToken);
    await waitForEvent(memberSocket, 'ready');

    const content = `uye-olarak-alinan-${randomUUID()}`;
    const receivedPromise = waitForEvent<{ content: string }>(
      memberSocket,
      'message:new',
    );
    memberSocket.emit('message:send', { content, roomName: room.name });

    const message = await receivedPromise;
    expect(message.content).toBe(content);
  }, 10000);

  it('arsivlenmis_odaya_mesaj_gonderme_denemesi_room_archived_hatasi_doner', async () => {
    // Sweep endpoint'i (Slice B'nin sonraki adımı) henüz yok - odayı elle
    // arşivleyip GoneException -> WsException(ROOM_ARCHIVED) zincirini
    // uçtan uca doğruluyor.
    const { accessToken } = await createTestUser();
    const name = `oda-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);
    const room = response.body as { id: string; name: string };
    createdRoomIds.push(room.id);

    await prisma.room.update({
      where: { id: room.id },
      data: { status: 'archived', archivedAt: new Date() },
    });

    const socket = connect(accessToken);
    await waitForEvent(socket, 'ready');

    const exceptionPromise = waitForEvent<{ status: string; code: string }>(
      socket,
      'exception',
    );
    socket.emit('message:send', {
      content: 'arsiv-denemesi',
      roomName: room.name,
    });

    const exception = await exceptionPromise;
    expect(exception.code).toBe('ROOM_ARCHIVED');

    const row = await prisma.message.findFirst({
      where: { content: 'arsiv-denemesi' },
    });
    expect(row).toBeNull();
  }, 10000);

  // M11c Slice A: kod tabanına eklenen İLK gerçek erişim-gating - şifreli
  // bir odaya join'den HİÇ geçmemiş biri WS üzerinden mesaj gönderemez.
  // GoneException -> WsException(ROOM_ARCHIVED) zinciriyle AYNI desen.
  it('sifreli_odaya_katilmadan_mesaj_gonderme_denemesi_ws_uzerinden_reddedilir', async () => {
    const creator = await createTestUser();
    const outsider = await createTestUser();
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: `oda-${randomUUID()}`, password: 'dogru-sifre-123' })
      .expect(201);
    const room = response.body as { id: string; name: string };
    createdRoomIds.push(room.id);

    const socket = connect(outsider.accessToken);
    await waitForEvent(socket, 'ready');

    const exceptionPromise = waitForEvent<{ status: string; code: string }>(
      socket,
      'exception',
    );
    socket.emit('message:send', {
      content: 'yetkisiz-deneme',
      roomName: room.name,
    });

    const exception = await exceptionPromise;
    expect(exception.code).toBe('ROOM_ACCESS_DENIED');

    const row = await prisma.message.findFirst({
      where: { content: 'yetkisiz-deneme' },
    });
    expect(row).toBeNull();
  }, 10000);

  it('get_rooms_varsayilan_olarak_arsivlenmisi_haric_tutar_includeArchived_ile_dahil_eder', async () => {
    const { accessToken } = await createTestUser();
    const name = `oda-${randomUUID()}`;
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name })
      .expect(201);
    const room = response.body as { id: string };
    createdRoomIds.push(room.id);

    await prisma.room.update({
      where: { id: room.id },
      data: { status: 'archived', archivedAt: new Date() },
    });

    const defaultList = await request(app.getHttpServer())
      .get('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const defaultNames = (defaultList.body as { name: string }[]).map(
      (r) => r.name,
    );
    expect(defaultNames).not.toContain(name);

    const withArchived = await request(app.getHttpServer())
      .get('/rooms?includeArchived=true')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const withArchivedRooms = withArchived.body as {
      name: string;
      status: string;
    }[];
    const archivedEntry = withArchivedRooms.find((r) => r.name === name);
    expect(archivedEntry?.status).toBe('archived');
  });

  it('post_join_idempotenttir_iki_kez_cagirmak_hata_vermez', async () => {
    const creator = await createTestUser();
    const joiner = await createTestUser();
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: `oda-${randomUUID()}` })
      .expect(201);
    const room = response.body as { id: string };
    createdRoomIds.push(room.id);

    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(201);
    // İkinci çağrı - zaten üyeyken 409 DEĞİL, sessizce başarı.
    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(201);

    const memberCount = await prisma.roomMember.count({
      where: { userId: joiner.userId, roomId: room.id },
    });
    expect(memberCount).toBe(1);
  });

  // M11c Slice A: kod tabanına eklenen İLK gerçek erişim-gating.
  it('sifreli_oda_yanlis_sifreyle_join_reddedilir_dogru_sifreyle_kabul_edilir', async () => {
    const creator = await createTestUser();
    const joiner = await createTestUser();
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: `oda-${randomUUID()}`, password: 'dogru-sifre-123' })
      .expect(201);
    const room = response.body as { id: string };
    createdRoomIds.push(room.id);

    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .send({ password: 'yanlis-sifre' })
      .expect(401);
    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .send({ password: 'dogru-sifre-123' })
      .expect(201);

    const memberCount = await prisma.roomMember.count({
      where: { userId: joiner.userId, roomId: room.id },
    });
    expect(memberCount).toBe(1);

    // Zaten üye - şifre olmadan tekrar join, idempotent (mevcut davranış).
    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(201);
  });

  it('post_leave_uyeligi_kaldirir_ve_idempotenttir', async () => {
    const creator = await createTestUser();
    const joiner = await createTestUser();
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: `oda-${randomUUID()}` })
      .expect(201);
    const room = response.body as { id: string };
    createdRoomIds.push(room.id);

    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/join`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/leave`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(201);

    const memberCount = await prisma.roomMember.count({
      where: { userId: joiner.userId, roomId: room.id },
    });
    expect(memberCount).toBe(0);

    // Zaten üye değilken tekrar ayrılmak - idempotent, hata değil.
    await request(app.getHttpServer())
      .post(`/rooms/${room.id}/leave`)
      .set('Authorization', `Bearer ${joiner.accessToken}`)
      .expect(201);
  });

  it('cekirdek_bir_odadan_ayrilma_denemesi_reddedilir', async () => {
    const { accessToken, userId } = await createTestUser();
    const generalRoom = await prisma.room.upsert({
      where: { name: CORE_ROOM_NAMES[0] },
      update: {},
      create: { name: CORE_ROOM_NAMES[0] },
    });
    await prisma.roomMember.upsert({
      where: {
        userId_roomId: { userId, roomId: generalRoom.id },
      },
      create: { userId, roomId: generalRoom.id },
      update: {},
    });

    await request(app.getHttpServer())
      .post(`/rooms/${generalRoom.id}/leave`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(403);

    const memberCount = await prisma.roomMember.count({
      where: { userId, roomId: generalRoom.id },
    });
    expect(memberCount).toBe(1);
  });

  it('scope_discoverable_uye_olunmayan_aktif_odalari_sayfali_doner', async () => {
    const creator = await createTestUser();
    const viewer = await createTestUser();
    // Doğrudan Prisma ile - RoomCreationThrottlerGuard (kullanıcı başına
    // günde 1 oda) gerçek POST /rooms akışıyla 3 oda oluşturmayı
    // engellerdi, bu test onu değil sayfalamayı doğruluyor.
    const roomNames = [0, 1, 2].map(() => `kesif-${randomUUID()}`).sort();
    for (const roomName of roomNames) {
      const room = await prisma.room.create({
        data: {
          name: roomName,
          creatorId: creator.userId,
          // Gerçek createRoom akışının nested-create'iyle aynı - kurucu
          // her zaman üye olur, bu test o davranışı simüle ediyor.
          members: { create: { userId: creator.userId } },
        },
      });
      createdRoomIds.push(room.id);
    }

    // Sayfa mekaniğinin gerçekten çalıştığını doğrula: limit=2 iken TAM 2
    // satır + dolu bir nextCursor dönmeli (yerel dev DB'nin biriken geçmişi
    // yüzünden HER ZAMAN limit'ten fazla aktif/keşfedilebilir oda var).
    const firstPage = await request(app.getHttpServer())
      .get(`/rooms?scope=discoverable&limit=2`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);
    const firstBody = firstPage.body as {
      rooms: { name: string }[];
      nextCursor: string | null;
    };
    expect(firstBody.rooms).toHaveLength(2);
    expect(firstBody.nextCursor).not.toBeNull();

    // İlk sayfanın hangi odaları içerdiği yerel DB'nin biriken alfabetik
    // sırasına bağlı (bu testin kendi odaları "kesif-" ile başlıyor, DB'de
    // alfabetik olarak ÖNCE gelen başka aktif odalar da olabilir) - bu
    // yüzden testin 3 odasının GERÇEKTEN keşfedilebilir listede olduğunu
    // kanıtlamak için cursor'ı tükenene kadar sayfalanıyor, tek sayfaya
    // güvenilmiyor.
    const discoveredNames: string[] = [];
    let cursor: string | undefined;
    for (let i = 0; i < 200; i += 1) {
      const page = await request(app.getHttpServer())
        .get(
          `/rooms?scope=discoverable&limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        )
        .set('Authorization', `Bearer ${viewer.accessToken}`)
        .expect(200);
      const body = page.body as {
        rooms: { name: string }[];
        nextCursor: string | null;
      };
      discoveredNames.push(...body.rooms.map((r) => r.name));
      if (!body.nextCursor) break;
      cursor = body.nextCursor;
    }
    for (const roomName of roomNames) {
      expect(discoveredNames).toContain(roomName);
    }
    // viewer kendi oluşturmadığı için hiçbiri "benim odalarım"da değil,
    // hepsi keşfedilebilir - creator ise KENDİ odalarının hiçbirini
    // keşfedilebilir listede görmemeli (zaten üye).
    const creatorDiscoverable = await request(app.getHttpServer())
      .get(`/rooms?scope=discoverable`)
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .expect(200);
    const creatorDiscoverableNames = (
      creatorDiscoverable.body as { rooms: { name: string }[] }
    ).rooms.map((r) => r.name);
    for (const roomName of roomNames) {
      expect(creatorDiscoverableNames).not.toContain(roomName);
    }
  });

  it('scope_all_uyelikten_bagimsiz_tum_odalari_doner_moderasyon_icin', async () => {
    const creator = await createTestUser();
    const viewer = await createTestUser();
    const response = await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${creator.accessToken}`)
      .send({ name: `oda-${randomUUID()}` })
      .expect(201);
    const room = response.body as { id: string; name: string };
    createdRoomIds.push(room.id);

    // viewer bu odaya hiç üye değil - scope=mine'da GÖRÜNMEZ ama
    // scope=all'da (moderasyon paneli) GÖRÜNÜR.
    const mineList = await request(app.getHttpServer())
      .get('/rooms')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);
    const mineNames = (mineList.body as { name: string }[]).map((r) => r.name);
    expect(mineNames).not.toContain(room.name);

    const allList = await request(app.getHttpServer())
      .get('/rooms?scope=all')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .expect(200);
    const allNames = (allList.body as { name: string }[]).map((r) => r.name);
    expect(allNames).toContain(room.name);
  });
});

// M11c Slice A: auth-signup-login.e2e-spec.ts'in "kanıtlanabilir onay
// (ValidationPipe)" describe'unun AYNI gerekçesi - yukarıdaki ana describe'a
// ValidationPipe eklemek riskli (mevcut testlerin fixture'larını kontrol
// etmek gerekir), bunun yerine kendi küçük TestingModule'ü.
describe('Oda oluşturma: şifre uzunluğu (ValidationPipe) (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('kisa_oda_sifresi_reddedilir', async () => {
    const jwtService = app.get(JwtService);
    const prisma = app.get(PrismaService);
    const user = await prisma.user.create({
      data: {
        email: `dto-${randomUUID()}@koqep.local`,
        username: `dto-${randomUUID().slice(0, 18)}`,
        passwordHash: 'test-not-a-real-hash',
      },
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });

    await request(app.getHttpServer())
      .post('/rooms')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: `oda-${randomUUID()}`, password: 'kisa' })
      .expect(400);

    await prisma.user.delete({ where: { id: user.id } });
  });
});
