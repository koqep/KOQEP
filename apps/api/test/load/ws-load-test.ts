import { NestFactory } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { Server } from 'node:http';
import { randomUUID } from 'node:crypto';
import { io, Socket } from 'socket.io-client';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/db/prisma.service';
import { CORE_ROOM_NAMES } from '../../src/db/core-rooms.constants';

// M2 Slice D: "basic load test at ~50 concurrent WS connections holds up
// without errors". Kendi NestFactory instance'ını açar (main.ts'in yaptığı
// gibi, Test.createTestingModule değil) ve gerçek /auth/signup'tan DEĞİL
// doğrudan Prisma'dan kullanıcı üretir - Slice C'nin signup rate limitini
// (20/60s IP başına) tetiklemeden 50 hesap açabilmek için. Her kullanıcı
// kendi WS mesaj limitinin (10/10s) İÇİNDE kalır - amaç limiti zorlamak
// değil, sistemin normal eşzamanlı kullanım altında ayakta kalması.
//
// CI'a bağlanmaz, `npm run test:load:ws` ile elle çalıştırılır.

const CONNECTION_COUNT = 50;
const MESSAGES_PER_USER = 4;
const READY_TIMEOUT_MS = 10_000;
const SETTLE_TIMEOUT_MS = 5_000;

interface UserSession {
  id: string;
  email: string;
  token: string;
  socket: Socket;
  received: number;
  errors: string[];
}

function connectSession(
  baseUrl: string,
  session: UserSession,
  createdMessageIds: string[],
): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = io(baseUrl, {
      auth: { token: session.token },
      transports: ['websocket'],
      forceNew: true,
    });
    session.socket = socket;

    const timer = setTimeout(() => {
      reject(new Error(`${session.email}: 'ready' zaman aşımına uğradı`));
    }, READY_TIMEOUT_MS);

    socket.once('ready', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.on('message:new', (message: { id: string }) => {
      session.received += 1;
      createdMessageIds.push(message.id);
    });
    socket.on('connect_error', (err: Error) => {
      session.errors.push(`connect_error: ${err.message}`);
      clearTimeout(timer);
      reject(err);
    });
    socket.on('error', (err: unknown) => {
      session.errors.push(`error: ${String(err)}`);
    });
    socket.on('disconnect', (reason: string) => {
      if (reason !== 'io client disconnect') {
        session.errors.push(`beklenmeyen disconnect: ${reason}`);
      }
    });
  });
}

async function main(): Promise<void> {
  console.log(
    `Yük testi başlıyor: ${CONNECTION_COUNT} eşzamanlı WS bağlantısı, kullanıcı başına ${MESSAGES_PER_USER} mesaj.`,
  );

  const app = await NestFactory.create(AppModule, { logger: false });
  await app.listen(0);

  const server = app.getHttpServer() as Server;
  const address = server.address();
  if (typeof address !== 'object' || address === null) {
    throw new Error('Beklenmeyen sunucu adresi formatı.');
  }
  const baseUrl = `http://localhost:${address.port}`;

  const prisma = app.get(PrismaService);
  const jwtService = app.get(JwtService);

  for (const name of CORE_ROOM_NAMES) {
    await prisma.room.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log(
    `${CONNECTION_COUNT} kullanıcı oluşturuluyor (doğrudan Prisma - gerçek /auth/signup değil, Slice C'nin signup rate limitini tetiklememek için)...`,
  );
  const userIds: string[] = [];
  const sessions: UserSession[] = [];
  for (let i = 0; i < CONNECTION_COUNT; i++) {
    const email = `load-test-${randomUUID()}@koqep.local`;
    const user = await prisma.user.create({
      data: { email, passwordHash: 'load-test-not-a-real-hash' },
    });
    userIds.push(user.id);
    const token = await jwtService.signAsync({
      sub: user.id,
      email: user.email,
    });
    sessions.push({
      id: user.id,
      email,
      token,
      socket: null as unknown as Socket,
      received: 0,
      errors: [],
    });
  }

  const createdMessageIds: string[] = [];
  const startedAt = Date.now();

  console.log('Bağlantılar açılıyor...');
  const connectResults = await Promise.allSettled(
    sessions.map((session) =>
      connectSession(baseUrl, session, createdMessageIds),
    ),
  );
  const connectFailures = connectResults.filter((r) => r.status === 'rejected');
  const connectedAt = Date.now();

  console.log(
    `Bağlantı süresi: ${connectedAt - startedAt}ms — başarılı: ${
      CONNECTION_COUNT - connectFailures.length
    }/${CONNECTION_COUNT}`,
  );
  connectFailures.forEach((f) => {
    if (f.status === 'rejected') console.error(`  - ${String(f.reason)}`);
  });

  console.log('Mesajlar gönderiliyor...');
  let totalSent = 0;
  const sendPromises: Promise<void>[] = [];
  for (const session of sessions) {
    if (!session.socket?.connected) continue;
    for (let m = 0; m < MESSAGES_PER_USER; m++) {
      const jitterMs = Math.random() * 2000;
      sendPromises.push(
        new Promise((resolve) => {
          setTimeout(() => {
            session.socket.emit('message:send', {
              content: `yuk-testi-${session.id}-${m}-${randomUUID()}`,
              roomName: CORE_ROOM_NAMES[m % CORE_ROOM_NAMES.length],
            });
            totalSent += 1;
            resolve();
          }, jitterMs);
        }),
      );
    }
  }
  await Promise.all(sendPromises);

  console.log(
    `${totalSent} mesaj gönderildi. Teslimatların oturması için ${SETTLE_TIMEOUT_MS}ms bekleniyor...`,
  );
  await new Promise((resolve) => setTimeout(resolve, SETTLE_TIMEOUT_MS));

  const totalReceived = sessions.reduce((sum, s) => sum + s.received, 0);
  const totalErrors = sessions.reduce((sum, s) => sum + s.errors.length, 0);
  const finishedAt = Date.now();

  console.log('\n--- Özet ---');
  console.log(
    `Bağlantı: ${CONNECTION_COUNT - connectFailures.length}/${CONNECTION_COUNT} başarılı`,
  );
  console.log(`Gönderilen mesaj: ${totalSent}`);
  console.log(`Alınan mesaj (tüm soketler toplamı): ${totalReceived}`);
  console.log(`Hata sayısı: ${totalErrors}`);
  console.log(`Toplam süre: ${finishedAt - startedAt}ms`);
  if (totalErrors > 0) {
    sessions
      .filter((s) => s.errors.length > 0)
      .forEach((s) => console.error(`  - ${s.email}: ${s.errors.join(', ')}`));
  }

  sessions.forEach((s) => s.socket?.close());
  if (createdMessageIds.length > 0) {
    await prisma.messageEdit.deleteMany({
      where: { messageId: { in: createdMessageIds } },
    });
    await prisma.message.deleteMany({
      where: { id: { in: createdMessageIds } },
    });
  }
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await app.close();

  const failed = connectFailures.length > 0 || totalErrors > 0;
  if (failed) {
    console.error('\nYÜK TESTİ BAŞARISIZ.');
    process.exit(1);
  } else {
    console.log('\nYük testi başarılı - hata yok.');
    process.exit(0);
  }
}

void main();
