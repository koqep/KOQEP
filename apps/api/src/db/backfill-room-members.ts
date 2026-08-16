import { Prisma, PrismaClient } from '@prisma/client';
import { CORE_ROOM_NAMES } from './core-rooms.constants';

export interface BackfillRoomMembersResult {
  created: number;
  alreadyMember: number;
}

// M7a Slice B (ADR-0009): RoomMember tablosu boş bir tablo olarak başlıyor -
// bu script mevcut kullanıcıları bugünkü "herkes her odada" davranışını
// KORUYACAK şekilde geriye dönük üye yapar, ama "her kullanıcı × her aktif
// oda" değil (bu, çözmeye çalıştığımız fan-out sorununu hiç çözmezdi).
// Üç kaynağın BİRLEŞİMİ, dedupe edilmiş, hepsi Prisma Client ile (hand-SQL
// yok):
//   1. Çekirdek odalar - TÜM kullanıcılar (yeni kullanıcıların signup'ta
//      otomatik kazanacağı üyelikle simetrik, geriye dönük).
//   2. Oda kurucuları - hiç mesaj yazmamış olsalar bile (createRoom'un
//      ileriye dönük otomatik-üyelik davranışıyla simetrik). Oda durumuna
//      (aktif/arşivlenmiş) göre FİLTRELENMİYOR - geçmiş bir katılım hâlâ
//      gerçek bir katılım.
//   3. Gerçek katılımcılar - Message.authorId'den DISTINCT (userId,roomId).
//      Aynı şekilde durum-bağımsız.
// Bilinen, kabul edilen sınır (icat edilmiş bir kısayol değil, şemanın
// gerçek bir sınırı): sessiz bir "lurker" (hiç mesaj yazmamış ama düzenli
// okuyan biri) bu backfill'de YAKALANAMAZ - bugünkü veri modelinde
// kullanıcı-başına "görüntüledi" sinyali yok (Room.lastViewedAt oda-
// seviyesinde, kullanıcı-seviyesinde değil).
// IDEMPOTENT: skipDuplicates + @@unique([userId,roomId]) - ikinci koşuda
// sıfır yeni satır üretir, her deploy'un preDeployCommand'ında güvenli.
export async function backfillRoomMembers(
  prisma: PrismaClient,
): Promise<BackfillRoomMembersResult> {
  const existingCount = await prisma.roomMember.count();

  const [coreRooms, allUsers, roomsWithCreator, messageAuthorRoomPairs] =
    await Promise.all([
      prisma.room.findMany({
        where: { name: { in: [...CORE_ROOM_NAMES] } },
        select: { id: true },
      }),
      prisma.user.findMany({ select: { id: true } }),
      prisma.room.findMany({
        where: { creatorId: { not: null } },
        select: { id: true, creatorId: true },
      }),
      prisma.message.findMany({
        where: { authorId: { not: null } },
        select: { authorId: true, roomId: true },
        distinct: ['authorId', 'roomId'],
      }),
    ]);

  const pairs = new Map<string, { userId: string; roomId: string }>();

  function addPair(userId: string, roomId: string): void {
    pairs.set(`${userId}:${roomId}`, { userId, roomId });
  }

  for (const room of coreRooms) {
    for (const user of allUsers) {
      addPair(user.id, room.id);
    }
  }
  for (const room of roomsWithCreator) {
    if (room.creatorId) {
      addPair(room.creatorId, room.id);
    }
  }
  for (const { authorId, roomId } of messageAuthorRoomPairs) {
    if (authorId) {
      addPair(authorId, roomId);
    }
  }

  const created = await insertPairs(prisma, Array.from(pairs.values()));

  return {
    created,
    alreadyMember: existingCount,
  };
}

// Kaynak sorguları (allUsers vb.) ile bu insert arasında bir kullanıcı/oda
// silinmişse (deploy-zamanı script'i olarak normalde tek-yazıcılı bir
// pencerede çalışır, ama savunma amaçlı) createMany FK ihlaliyle patlar -
// hata YUTULMUYOR, geçerli id'lere göre filtrelenip BİR KEZ tekrar deneniyor.
async function insertPairs(
  prisma: PrismaClient,
  allPairs: Array<{ userId: string; roomId: string }>,
): Promise<number> {
  try {
    const result = await prisma.roomMember.createMany({
      data: allPairs,
      skipDuplicates: true,
    });
    return result.count;
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2003'
    ) {
      throw error;
    }
    const [validUsers, validRooms] = await Promise.all([
      prisma.user.findMany({ select: { id: true } }),
      prisma.room.findMany({ select: { id: true } }),
    ]);
    const userIds = new Set(validUsers.map((u) => u.id));
    const roomIds = new Set(validRooms.map((r) => r.id));
    const validPairs = allPairs.filter(
      (pair) => userIds.has(pair.userId) && roomIds.has(pair.roomId),
    );
    const retryResult = await prisma.roomMember.createMany({
      data: validPairs,
      skipDuplicates: true,
    });
    return retryResult.count;
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result = await backfillRoomMembers(prisma);
  console.log(
    `RoomMember backfill tamam. Oluşturulan: ${result.created}, önceden mevcut: ${result.alreadyMember}.`,
  );
  await prisma.$disconnect();
}

if (require.main === module) {
  void main();
}
