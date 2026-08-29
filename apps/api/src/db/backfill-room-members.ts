import { Prisma, PrismaClient } from '@prisma/client';
import { CORE_ROOM_NAMES } from './core-rooms.constants';

export interface BackfillRoomMembersResult {
  created: number;
  alreadyMember: number;
  skippedInvalid: number;
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

  const { created, skippedInvalid } = await insertPairs(
    prisma,
    Array.from(pairs.values()),
  );

  return {
    created,
    alreadyMember: existingCount,
    skippedInvalid,
  };
}

interface InsertPairsResult {
  created: number;
  skippedInvalid: number;
}

// Kaynak sorguları (allUsers vb.) ile bu insert arasında bir kullanıcı/oda
// silinmiş olabilir (deploy-zamanı script'i olarak normalde tek-yazıcılı bir
// pencerede çalışır, ama e2e test süiti PARALEL koşan başka dosyaların
// gerçek /auth/delete-account çağırdığı bir ortamda bunu KANITLADI - tek
// seferlik "filtrele + tekrar dene" YETMEDİ, çünkü retry'ın KENDİ okuma-
// yazma penceresi de aynı şekilde yarışa açık, sürekli churn'de aynı
// olasılıkla tekrar patlıyor. Kalıcı çözüm: toplu insert (skipDuplicates)
// hızlı yol olarak KALIYOR, ama P2003'te tekrar toplu denemek yerine
// SATIR SATIR dene - her satırın FK kontrolü kendi insert'iyle ATOMİK
// olduğu için o satırın kendi penceresi tek bir round-trip'e iner. O anda
// gerçekten geçersiz olan (kullanıcı/oda silinmiş) satır atlanır - script
// idempotent olduğu için bir sonraki koşuda geçerliyse zaten yakalanır.
export async function insertPairs(
  prisma: PrismaClient,
  allPairs: Array<{ userId: string; roomId: string }>,
): Promise<InsertPairsResult> {
  try {
    const result = await prisma.roomMember.createMany({
      data: allPairs,
      skipDuplicates: true,
    });
    return { created: result.count, skippedInvalid: 0 };
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== 'P2003'
    ) {
      throw error;
    }
    let created = 0;
    let skippedInvalid = 0;
    for (const pair of allPairs) {
      try {
        await prisma.roomMember.create({ data: pair });
        created += 1;
      } catch (rowError) {
        if (
          rowError instanceof Prisma.PrismaClientKnownRequestError &&
          rowError.code === 'P2003'
        ) {
          // Bu satırın kullanıcısı/odası bu anda gerçekten yok - yarışın
          // kendisi, atla.
          skippedInvalid += 1;
          continue;
        }
        if (
          rowError instanceof Prisma.PrismaClientKnownRequestError &&
          rowError.code === 'P2002'
        ) {
          // Zaten üye - createMany'nin skipDuplicates'ının tek-satır
          // eşdeğeri, hata değil.
          continue;
        }
        throw rowError;
      }
    }
    return { created, skippedInvalid };
  }
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const result = await backfillRoomMembers(prisma);
  console.log(
    `RoomMember backfill tamam. Oluşturulan: ${result.created}, önceden mevcut: ${result.alreadyMember}, atlanan (geçersiz FK): ${result.skippedInvalid}.`,
  );
  await prisma.$disconnect();
}

if (require.main === module) {
  void main();
}
