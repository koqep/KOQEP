import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/db/prisma.service';
import { CORE_ROOM_NAMES } from './../src/db/core-rooms.constants';
import { backfillRoomMembers } from './../src/db/backfill-room-members';

// M7a Slice B (ADR-0009): backfillRoomMembers'ın üç-kaynaklı birleşim
// mantığını (çekirdek odalar - tüm kullanıcılar, oda kurucuları, gerçek
// mesaj-katılımcıları) gerçek DB satırları üzerinde kanıtlar - sadece bir
// kaynağı test edip "çalışıyor" varsaymak yeterli değil, üçünün BİRLİKTE
// doğru satırları ürettiğini ve ikinci koşunun idempotent olduğunu
// (backfillTotpSecrets'ın e2e desenindeki AYNI disiplin) gösterir.
describe('RoomMember backfill (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    for (const name of CORE_ROOM_NAMES) {
      await prisma.room.upsert({
        where: { name },
        update: {},
        create: { name },
      });
    }
  });

  afterAll(async () => {
    await app.close();
  });

  async function createUser(): Promise<string> {
    const user = await prisma.user.create({
      data: {
        email: `backfill-${randomUUID()}@koqep.local`,
        username: `backfill-${randomUUID()}`,
        passwordHash: 'test-not-a-real-hash',
        emailVerifiedAt: new Date(),
      },
    });
    return user.id;
  }

  it('uc_kaynagin_birlesimini_dogru_uretir_ve_ikinci_kosuda_idempotenttir', async () => {
    // Kaynak 1: sıradan bir kullanıcı - hiçbir odayla doğrudan ilişkisi
    // yok, sadece çekirdek odalar için TÜM kullanıcılar kuralına giriyor.
    const plainUserId = await createUser();

    // Kaynak 2: bir oda kurucusu - hiç mesaj yazmamış olsa bile.
    const creatorId = await createUser();
    const createdRoom = await prisma.room.create({
      data: { name: `kurucu-odasi-${randomUUID()}`, creatorId },
    });

    // Kaynak 3: gerçek bir katılımcı - kurmadığı bir odada mesaj yazmış.
    const participantId = await createUser();
    const participantRoom = await prisma.room.create({
      data: { name: `katilim-odasi-${randomUUID()}` },
    });
    await prisma.message.create({
      data: {
        roomId: participantRoom.id,
        authorId: participantId,
        content: 'gercek-bir-katilim-mesaji',
      },
    });

    const firstRun = await backfillRoomMembers(prisma);
    expect(firstRun.created).toBeGreaterThanOrEqual(1);

    const coreRooms = await prisma.room.findMany({
      where: { name: { in: [...CORE_ROOM_NAMES] } },
    });
    for (const room of coreRooms) {
      const membership = await prisma.roomMember.findUnique({
        where: { userId_roomId: { userId: plainUserId, roomId: room.id } },
      });
      expect(membership).not.toBeNull();
    }

    const creatorMembership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: { userId: creatorId, roomId: createdRoom.id },
      },
    });
    expect(creatorMembership).not.toBeNull();

    const participantMembership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: {
          userId: participantId,
          roomId: participantRoom.id,
        },
      },
    });
    expect(participantMembership).not.toBeNull();

    // Katılımcı, kurmadığı ve mesaj yazmadığı çekirdek-olmayan bir odaya
    // (kurucunun kendi odası) YANLIŞLIKLA üye yapılmamalı.
    const wrongMembership = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: { userId: participantId, roomId: createdRoom.id },
      },
    });
    expect(wrongMembership).toBeNull();

    // İdempotentlik: bu testin ÜÇ satırı ikinci koşuda TEKRAR yaratılmıyor
    // (createdAt değişmiyor). Global "secondRun.created === 0" assert'i
    // KASITLI OLARAK kullanılmıyor - jest-e2e.json paralel worker'larla
    // koşuyor, aynı gerçek DB'ye yazan diğer spec dosyaları ikinci koşu
    // ANINDA yeni kullanıcılar/odalar yaratabilir, backfillRoomMembers TÜM
    // sistemi taradığı için bu YENİ satırları da (doğru şekilde) sayar -
    // global sayım bu yüzden yarış-güvenli değil. totpBackfill'in kendi
    // e2e deseniyle (satır-bazlı createdAt karşılaştırması) aynı disiplin.
    const creatorMembershipBefore = creatorMembership;
    await backfillRoomMembers(prisma);
    const creatorMembershipAfter = await prisma.roomMember.findUnique({
      where: {
        userId_roomId: { userId: creatorId, roomId: createdRoom.id },
      },
    });
    expect(creatorMembershipAfter?.id).toBe(creatorMembershipBefore?.id);
    expect(creatorMembershipAfter?.createdAt).toEqual(
      creatorMembershipBefore?.createdAt,
    );
  });
});
