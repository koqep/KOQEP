import { spawn, ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import { io, Socket } from 'socket.io-client';
import pidusage from 'pidusage';
import { CORE_ROOM_NAMES } from '../../src/db/core-rooms.constants';

// M7a Slice I: "en az 300-500 eşzamanlı bağlantı, gerçek gecikme/bellek
// ölçümüyle" (AC). Sunucu ve yük üreteci (bu script) BİLEREK AYRI process'ler
// - eskiden (M2 Slice D) script kendi NestFactory instance'ını AYNI process'te
// açıyordu, bu da "sunucu belleği" ölçülmeye çalışılsa bile onu 500
// socket.io-client bağlantısının kendi belleğiyle karıştırırdı (production'da
// sunucu asla kendi içinde 500 client bağlantısı taşımıyor - saf test-harness
// kirliliği). Bu script artık sunucuyu `PORT=4100` ile ayrı bir child
// process'te başlatıyor, `/health`'in yanıt vermesini bekliyor, ve
// `pidusage(serverProcess.pid)` ile SADECE o process'in gerçek RSS'ini
// örnekliyor - client'ın kendi belleği hiç karışmıyor.
//
// Gecikme ölçümü: gönderilen her mesajın content'ine bir gönderim zaman
// damgası gömülüyor (`yuk-testi|<sendTime>|<uuid>`), `message:new` alınınca
// content'ten geri okunup receiveTime - sendTime hesaplanıyor - ayrı bir
// Map/eşleştirme yapısı gerekmiyor, zaman damgası mesajın kendisinde taşınıyor.
//
// `RoomMember` seed'leniyor (M7a Slice B'den beri `handleConnection` SADECE
// üye olunan odalara join ediyor - üyeliksiz sentetik kullanıcılar hiçbir
// mesaj ALAMAZDI, eski script bunu hiç yapmıyordu).
//
// Gerçek /auth/signup DEĞİL, doğrudan Prisma'dan kullanıcı üretiyor (Slice
// C'nin signup rate limitini tetiklememek için). CI'a bağlanmaz, `npm run
// test:load:ws` ile elle çalıştırılır (sunucu+client'ın AYNI local makinede,
// local Postgres'e karşı koştuğu varsayılır).

const CONNECTION_COUNT = Number(process.env.LOAD_TEST_CONNECTIONS) || 500;
const MESSAGES_PER_USER = 4;
const READY_TIMEOUT_MS = 10_000;
const SETTLE_TIMEOUT_MS = 5_000;
const SERVER_PORT = 4100;
const SERVER_READY_TIMEOUT_MS = 30_000;
const MEMORY_SAMPLE_INTERVAL_MS = 1_000;
const MARKER_PREFIX = 'yuk-testi';

interface UserSession {
  id: string;
  email: string;
  token: string;
  socket: Socket;
  received: number;
  errors: string[];
}

function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.ceil((p / 100) * sortedValues.length) - 1),
  );
  return sortedValues[index];
}

async function waitForHealth(
  baseUrl: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) return;
    } catch {
      // Sunucu henüz ayakta değil - tekrar dene.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Sunucu ${timeoutMs}ms içinde /health'e yanıt vermedi.`);
}

function connectSession(
  baseUrl: string,
  session: UserSession,
  createdMessageIds: string[],
  latenciesMs: number[],
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
    socket.on('message:new', (message: { id: string; content: string }) => {
      session.received += 1;
      createdMessageIds.push(message.id);
      if (message.content.startsWith(`${MARKER_PREFIX}|`)) {
        const [, sendTimeStr] = message.content.split('|');
        const sendTime = Number(sendTimeStr);
        if (Number.isFinite(sendTime)) {
          latenciesMs.push(Date.now() - sendTime);
        }
      }
    });
    socket.on('connect_error', (err: Error) => {
      session.errors.push(`connect_error: ${err.message}`);
      clearTimeout(timer);
      reject(err);
    });
    socket.on('error', (err: unknown) => {
      session.errors.push(`error: ${String(err)}`);
    });
    // NestJS'in varsayılan WsExceptionsHandler'ı, WsException OLMAYAN
    // her hatayı (ör. bir Prisma transaction timeout'u, tam da yük
    // altında beklenebilecek türden) çağıran soketin kendisine 'exception'
    // event'i olarak emit ediyor (STATE.md'nin kurulu tuzağı: "WsException
    // DIŞINDAKİ her şey jenerik hataya çevrilir") - bu dinleyici olmadan
    // script sunucu tarafındaki gerçek hataları HİÇ görmüyor, "hatasız"
    // diye yanlış bir sonuç raporlardı (500 bağlantılık gerçek koşumda
    // TAM OLARAK bu şekilde bulundu).
    socket.on('exception', (err: unknown) => {
      session.errors.push(`exception: ${JSON.stringify(err)}`);
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

  console.log(
    'Sunucu ayrı bir process olarak başlatılıyor (PORT=' + SERVER_PORT + ')...',
  );
  // dist/main.js (ts-node/src/main.ts DEĞİL) - hem çok daha hızlı açılıyor
  // (ts-node'un soğuk derleme süresi yok) hem `start:prod`'un GERÇEKTEN
  // çalıştırdığı komutla birebir aynı, ölçülen bellek production'a daha
  // temsili. `npm run test:load:ws` script'i bu yüzden önce `npm run build`
  // çalıştırıyor (package.json).
  const serverProcess: ChildProcess = spawn(
    process.execPath,
    ['dist/main.js'],
    {
      env: { ...process.env, PORT: String(SERVER_PORT) },
      stdio: ['ignore', 'inherit', 'inherit'],
    },
  );
  let serverExitedEarly = false;
  serverProcess.once('exit', (code) => {
    if (code !== null && code !== 0) serverExitedEarly = true;
  });

  const baseUrl = `http://localhost:${SERVER_PORT}`;
  const prisma = new PrismaClient();
  const jwtService = new JwtService({
    secret: process.env.JWT_SECRET,
    signOptions: { expiresIn: '15m' },
  });
  const userIds: string[] = [];
  let exitCode = 0;

  try {
    await waitForHealth(baseUrl, SERVER_READY_TIMEOUT_MS);
    if (serverExitedEarly) {
      throw new Error("Sunucu process'i /health yanıt vermeden önce çöktü.");
    }
    console.log('Sunucu hazır.');

    for (const name of CORE_ROOM_NAMES) {
      await prisma.room.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
    const coreRooms = await prisma.room.findMany({
      where: { name: { in: [...CORE_ROOM_NAMES] } },
      select: { id: true },
    });

    console.log(
      `${CONNECTION_COUNT} kullanıcı oluşturuluyor (doğrudan Prisma - gerçek /auth/signup değil, Slice C'nin signup rate limitini tetiklememek için)...`,
    );
    const sessions: UserSession[] = [];
    const roomMemberData: { userId: string; roomId: string }[] = [];
    for (let i = 0; i < CONNECTION_COUNT; i++) {
      const email = `load-test-${randomUUID()}@koqep.local`;
      const username = `load-test-${randomUUID()}`;
      const user = await prisma.user.create({
        data: { email, username, passwordHash: 'load-test-not-a-real-hash' },
      });
      userIds.push(user.id);
      for (const room of coreRooms) {
        roomMemberData.push({ userId: user.id, roomId: room.id });
      }
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
    // M7a Slice B'den beri handleConnection SADECE RoomMember satırı olan
    // odalara join ediyor - bu satırlar olmadan hiçbir sentetik kullanıcı
    // hiçbir mesaj ALAMAZ, broadcast hiç ölçülmemiş olurdu.
    await prisma.roomMember.createMany({
      data: roomMemberData,
      skipDuplicates: true,
    });

    const createdMessageIds: string[] = [];
    const latenciesMs: number[] = [];
    const memorySamplesBytes: number[] = [];
    const memoryTimer = setInterval(() => {
      if (!serverProcess.pid) return;
      pidusage(serverProcess.pid)
        .then((stats) => memorySamplesBytes.push(stats.memory))
        .catch(() => {
          // Sunucu process'i örnekleme anında kapanmış olabilir - yoksay.
        });
    }, MEMORY_SAMPLE_INTERVAL_MS);

    const startedAt = Date.now();

    console.log('Bağlantılar açılıyor...');
    const connectResults = await Promise.allSettled(
      sessions.map((session) =>
        connectSession(baseUrl, session, createdMessageIds, latenciesMs),
      ),
    );
    const connectFailures = connectResults.filter(
      (r) => r.status === 'rejected',
    );
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
                content: `${MARKER_PREFIX}|${Date.now()}|${randomUUID()}`,
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

    clearInterval(memoryTimer);

    const totalReceived = sessions.reduce((sum, s) => sum + s.received, 0);
    const totalErrors = sessions.reduce((sum, s) => sum + s.errors.length, 0);
    const finishedAt = Date.now();

    const sortedLatencies = [...latenciesMs].sort((a, b) => a - b);
    const sortedMemory = [...memorySamplesBytes].sort((a, b) => a - b);
    const toMb = (bytes: number) => Math.round((bytes / 1024 / 1024) * 10) / 10;

    console.log('\n--- Özet ---');
    console.log(
      `Bağlantı: ${CONNECTION_COUNT - connectFailures.length}/${CONNECTION_COUNT} başarılı`,
    );
    console.log(`Gönderilen mesaj: ${totalSent}`);
    console.log(`Alınan mesaj (tüm soketler toplamı): ${totalReceived}`);
    console.log(`Hata sayısı: ${totalErrors}`);
    console.log(`Toplam süre: ${finishedAt - startedAt}ms`);
    if (sortedLatencies.length > 0) {
      console.log(
        `Gecikme (ms) — min:${sortedLatencies[0]} p50:${percentile(sortedLatencies, 50)} p95:${percentile(sortedLatencies, 95)} p99:${percentile(sortedLatencies, 99)} max:${sortedLatencies[sortedLatencies.length - 1]} (n=${sortedLatencies.length})`,
      );
    } else {
      console.log('Gecikme: ölçülebilir mesaj alınmadı (n=0).');
    }
    if (sortedMemory.length > 0) {
      const avgMb = toMb(
        memorySamplesBytes.reduce((a, b) => a + b, 0) /
          memorySamplesBytes.length,
      );
      console.log(
        `Sunucu RSS (MB) — ortalama:${avgMb} peak:${toMb(sortedMemory[sortedMemory.length - 1])} (n=${sortedMemory.length} örnek)`,
      );
    } else {
      console.log('Sunucu belleği: hiç örnek alınamadı.');
    }
    if (totalErrors > 0) {
      sessions
        .filter((s) => s.errors.length > 0)
        .forEach((s) =>
          console.error(`  - ${s.email}: ${s.errors.join(', ')}`),
        );
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
    // RoomMember satırları User silinince onDelete:Cascade ile otomatik gider.
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });

    const failed = connectFailures.length > 0 || totalErrors > 0;
    if (failed) {
      console.error('\nYÜK TESTİ BAŞARISIZ.');
      exitCode = 1;
    } else {
      console.log('\nYük testi başarılı - hata yok.');
    }
  } catch (error) {
    console.error('\nYük testi hata ile sonlandı:', error);
    exitCode = 1;
  } finally {
    await prisma.$disconnect();
    serverProcess.kill('SIGTERM');
  }

  process.exit(exitCode);
}

void main();
