import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import request from 'supertest';
import { App } from 'supertest/types';
import * as argon2 from 'argon2';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';

function waitForEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event, resolve));
}

// M2.5 Slice D'nin asıl gereksinimi: Slice C, silinmiş bir kullanıcının
// hâlâ açık soketinin (15 dk'lık JWT penceresi) mesaj göndermeyi denemesi
// durumunda sessizce yutulduğunu tespit edip bu slice'a erteledi. Bu dosya
// gerçek bir soket + gerçek POST /auth/delete-account ile bunun artık
// gerçekten çözüldüğünü kanıtlıyor - messages-gateway.e2e-spec.ts'in
// app.listen(0) + socket.io-client deseni (delete-account.e2e-spec.ts
// sadece app.init() kullanıyor, gerçek bir portu dinlemiyor).
describe('Account deletion - açık soket (e2e)', () => {
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
    for (const name of CORE_ROOM_NAMES) {
      await prisma.room.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
  });

  afterAll(async () => {
    openSockets.forEach((socket) => socket.close());
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
    id: string;
    email: string;
    password: string;
    accessToken: string;
  }> {
    const email = `user-${randomUUID()}@koqep.local`;
    const username = `user-${randomUUID()}`;
    const password = 'a-strong-password';
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({
      data: { email, username, passwordHash, emailVerifiedAt: new Date() },
    });
    const accessToken = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    return { id: user.id, email, password, accessToken };
  }

  it('hesap_silinince_acik_soket_gercekten_kopar_ve_artik_mesaj_gonderemez', async () => {
    const user = await createTestUser();
    const client = connect(user.accessToken);
    await waitForEvent(client, 'ready');

    const disconnectPromise = waitForEvent(client, 'disconnect');

    await request(app.getHttpServer())
      .post('/auth/delete-account')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .send({ password: user.password })
      .expect(201);

    await disconnectPromise;

    const deletedUser = await prisma.user.findUnique({
      where: { id: user.id },
    });
    expect(deletedUser).toBeNull();

    // Kopmuş soketten mesaj göndermeyi denemek (gerçek bir client bunu
    // yapamaz ama savunma amaçlı) - hiçbir satır oluşturmuyor.
    client.emit('message:send', { content: 'kopuk-soketten-deneme' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const row = await prisma.message.findFirst({
      where: { content: 'kopuk-soketten-deneme' },
    });
    expect(row).toBeNull();
  }, 10000);
});
