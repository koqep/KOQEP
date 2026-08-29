import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import { TrafficLog } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { randomTestIp } from './support/random-test-ip';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

// M6b Slice D: MessagesGateway'in handleConnection/handleDisconnect'inin
// gerçek uçtan uca kanıtı - özellikle kullanıcının onayladığı tasarım
// kararının kanıtı: reddedilen (geçersiz token) bir bağlantı da START+END
// çiftini üretir, userId ikisinde de null. Jest e2e dosyaları PARALEL
// koştuğu için (bkz. traffic-log-rest.e2e-spec.ts'in AYNI gerekçesi) her
// bağlantı `trackedTestIp()`'in (support/random-test-ip.ts) ürettiği
// benzersiz bir X-Forwarded-For ile açılıyor, TÜM DB sorguları o IP'ye
// göre daraltılıyor.
describe('TrafficLog WS gateway (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let baseUrl: string;
  const createdUserIds: string[] = [];
  const usedIpAddresses: string[] = [];
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
    // writeTrafficLogRow (handleDisconnect'in çağırdığı) fire-and-forget -
    // socket.close() DÖNDÜĞÜNDE WS_CONNECTION_END satırı henüz DB'ye
    // yazılmamış olabilir. Aşağıdaki user.deleteMany bu yazının FK'sini
    // (userId) o anda geçersiz kılarsa P2003 üretir - writeTrafficLogRow
    // bunu userId:null ile TEK retry'la toparlıyor, ama app.close()'un
    // $disconnect()'i o retry'ı da yarışabilir ("Response from the Engine
    // was empty"). Kullanıcıları silmeden ÖNCE her IP için END satırının
    // gerçekten landed olduğunu bekle - aynı dosyanın kendi
    // waitForTrafficLogRow deseni.
    for (const ip of usedIpAddresses) {
      try {
        await waitForTrafficLogRow({
          ipAddress: ip,
          serviceType: 'WS_CONNECTION_END',
        });
      } catch {
        // Bu IP'nin bağlantısı hiç END üretmediyse (beklenmeyen bir
        // durum) burada takılıp kalmak yerine devam et - aşağıdaki
        // cleanup zaten en kötü ihtimalle aynı P2003/retry riskini taşır,
        // yeni bir regresyon YARATMIYORUZ, sadece iyileştiriyoruz.
      }
    }
    if (usedIpAddresses.length > 0) {
      await prisma.trafficLog.deleteMany({
        where: { ipAddress: { in: usedIpAddresses } },
      });
    }
    if (createdUserIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: createdUserIds } },
      });
    }
    await app.close();
  });

  function trackedTestIp(): string {
    const ip = randomTestIp();
    usedIpAddresses.push(ip);
    return ip;
  }

  async function createTestUser(): Promise<{
    userId: string;
    accessToken: string;
  }> {
    const user = await prisma.user.create({
      data: {
        email: `traffic-log-ws-${randomUUID()}@koqep.local`,
        username: `traffic-log-ws-${randomUUID()}`,
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

  function connect(token: string | undefined, ip: string): Socket {
    const socket = io(baseUrl, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
      extraHeaders: { 'x-forwarded-for': ip },
    });
    openSockets.push(socket);
    return socket;
  }

  async function waitForTrafficLogRow(
    where: NonNullable<
      Parameters<PrismaService['trafficLog']['findFirst']>[0]
    >['where'],
  ): Promise<TrafficLog> {
    const maxAttempts = 20;
    const delayMs = 50;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const row = await prisma.trafficLog.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
      });
      if (row) {
        return row;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    throw new Error('Beklenen TrafficLog satırı zaman aşımında oluşmadı.');
  }

  it('basarili_baglanti_start_ve_end_satiri_uretir_ayni_connectionId', async () => {
    const { userId, accessToken } = await createTestUser();
    const ip = trackedTestIp();
    const socket = connect(accessToken, ip);

    await waitForEvent(socket, 'ready');

    const startRow = await waitForTrafficLogRow({
      ipAddress: ip,
      serviceType: 'WS_CONNECTION_START',
    });
    expect(startRow.userId).toBeNull();
    expect(startRow.startedAt).not.toBeNull();
    expect(startRow.endedAt).toBeNull();
    expect(startRow.connectionId).not.toBeNull();
    expect(startRow.integrityHash).toMatch(/^[0-9a-f]{64}$/);

    socket.close();

    const endRow = await waitForTrafficLogRow({
      connectionId: startRow.connectionId,
      serviceType: 'WS_CONNECTION_END',
    });
    expect(endRow.userId).toBe(userId);
    expect(endRow.startedAt).toBeNull();
    expect(endRow.endedAt).not.toBeNull();
    expect(endRow.ipAddress).toBe(ip);
    expect(endRow.integrityHash).not.toBe(startRow.integrityHash);
  }, 10000);

  it('reddedilen_baglanti_start_ve_end_ikisi_de_userId_null_ayni_connectionId', async () => {
    const ip = trackedTestIp();
    const socket = connect('gecersiz-bir-token', ip);

    await waitForEvent(socket, 'disconnect');

    const startRow = await waitForTrafficLogRow({
      ipAddress: ip,
      serviceType: 'WS_CONNECTION_START',
    });
    expect(startRow.userId).toBeNull();

    const endRow = await waitForTrafficLogRow({
      connectionId: startRow.connectionId,
      serviceType: 'WS_CONNECTION_END',
    });
    expect(endRow.userId).toBeNull();
    expect(endRow.connectionId).toBe(startRow.connectionId);
  }, 10000);
});
