import {
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { SocketRegistryService } from './socket-registry.service';
import { CORE_ROOM_NAMES } from '../db/core-rooms.constants';

const ARCHIVE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const DELETE_AFTER_MS = 60 * 24 * 60 * 60 * 1000;
// M7a Slice B: keşfedilebilir-odalar listesi, üye olmadığın TÜM aktif
// odaları döner - bu dilimi motive eden ölçekte (yüzlerce oda) sınırsız
// olamaz. getRecentMessages'ın (messages.service.ts) DEFAULT_PAGE_SIZE'ıyla
// AYNI cursor+limit deseni, farklı bir sayı (oda satırları mesaj
// satırlarından çok daha küçük/az).
const DEFAULT_ROOM_PAGE_SIZE = 30;

export interface RoomSummary {
  id: string;
  name: string;
  description: string | null;
  lastActivityAt: Date;
  status: RoomStatus;
}

export interface RoomPage {
  rooms: RoomSummary[];
  nextCursor: string | null;
}

const ROOM_SUMMARY_SELECT = {
  id: true,
  name: true,
  description: true,
  lastActivityAt: true,
  status: true,
} as const;

interface PurgeCandidate {
  id: string;
  archivedAt: Date | null;
  lastViewedAt: Date | null;
}

// "Sıfır görüntülenme" - lastViewedAt hiç set edilmemiş YA DA arşivlenme
// anından ÖNCEKİ bir görüntülemeyi taşıyor (arşivlendikten SONRA kimse
// bakmamış). Prisma aynı satırın iki kolonunu where'de karşılaştıramıyor
// (raw SQL gerekir) - bu kod tabanında hiç $queryRaw/$executeRaw
// kullanılmıyor, o yüzden adaylar tek kolonlu bir filtreyle çekilip bu
// fonksiyonla JS'te süzülüyor (bu ölçekte performans sorunu değil).
function isEligibleForPurge(room: PurgeCandidate): boolean {
  return (
    room.lastViewedAt === null ||
    (room.archivedAt !== null && room.lastViewedAt < room.archivedAt)
  );
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketRegistry: SocketRegistryService,
  ) {}

  // `deleted` durumu hiçbir kod yolunda gerçekten yazılmıyor (ADR-0006:
  // silme gerçek bir row hard-delete, status flip değil) - filtre yine de
  // tam tip güvenliği için `RoomStatus`'un üç değerini de kapsıyor.
  //
  // M7a Slice B: bu artık "benim odalarım" - normal switcher'ın ÇAĞIRDIĞI
  // (ADR-0009) tek metod, sadece DÖNEN VERİNİN anlamı üyelik-scoped oldu.
  // Moderasyon paneli için TÜM odalar `listAllRooms`'ta, keşif için
  // üye-olunmayan odalar `listDiscoverableRooms`'ta.
  async listRooms(
    userId: string,
    includeArchived = false,
  ): Promise<RoomSummary[]> {
    return this.prisma.room.findMany({
      where: {
        status: includeArchived ? { in: ['active', 'archived'] } : 'active',
        members: { some: { userId } },
      },
      select: ROOM_SUMMARY_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  // Bugünkü, üyelikten TAMAMEN bağımsız davranış - `RoomModerationSection`
  // moderatörün üyeliğinden bağımsız TÜM odaları yönetebilmesi için
  // bunu çağırıyor. Erişim seviyesi `GET /rooms`'un ZATEN bugün sahip
  // olduğu seviyeyle birebir aynı (JwtAuthGuard dışında bir kısıtlama
  // YOK) - yeni bir moderatör-kontrolü eklemek bu dilimin amacıyla
  // ilgisiz scope creep olurdu.
  // M7b Slice E: aktiviteye göre sıralanıyor (keşif ile TUTARLI olsun diye,
  // kullanıcının kararı) - "benim odalarım" (listRooms) BİLEREK alfabetik
  // kalıyor, switcher'ın buton konumu sabit tutulmalı (kas hafızası).
  async listAllRooms(includeArchived = false): Promise<RoomSummary[]> {
    return this.prisma.room.findMany({
      where: {
        status: includeArchived ? { in: ['active', 'archived'] } : 'active',
      },
      select: ROOM_SUMMARY_SELECT,
      orderBy: [{ lastActivityAt: 'desc' }, { name: 'asc' }],
    });
  }

  // Üye olunmayan aktif odalar - `includeArchived`'ı BİLEREK yok sayıyor
  // (ölü bir odayı "keşfetmenin" anlamı yok). Sayfalı: getRecentMessages'ın
  // (messages.service.ts) AYNI cursor+limit deseni. M7b Slice E: aktiviteye
  // göre sıralanıyor - ama cursor YİNE `name` üzerinden (Room.name @unique,
  // Prisma'nın cursor alanı unique olmak ZORUNDA, orderBy'daki DİĞER
  // alanların unique olması gerekmiyor - getRecentMessages'ın
  // `orderBy:[{createdAt:'desc'},{id:'desc'}]`+`cursor:{id}` deseniyle
  // AYNI mantık). `lastActivityAt` unique DEĞİL - iki oda aynı pencerede
  // (ROOM_ACTIVITY_DEBOUNCE_MS) güncellenmiş olabilir, o yüzden cursor
  // ASLA lastActivityAt üzerinden verilmiyor, sadece ikincil sıralama.
  async listDiscoverableRooms(
    userId: string,
    cursor?: string,
    limit: number = DEFAULT_ROOM_PAGE_SIZE,
  ): Promise<RoomPage> {
    const rows = await this.prisma.room.findMany({
      where: { status: 'active', members: { none: { userId } } },
      select: ROOM_SUMMARY_SELECT,
      orderBy: [{ lastActivityAt: 'desc' }, { name: 'asc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { name: cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const rooms = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? rooms[rooms.length - 1].name : null;

    return { rooms, nextCursor };
  }

  // Idempotent: zaten üyeyse yeni bir satır YARATMADAN mevcut olanı döner
  // (409 değil - ürünün düşük-sürtünmeli kimliğiyle tutarlı, "katıl"
  // butonuna iki kez basmak bir hata değil). `createRoom`'un kurucu için
  // yaptığı AYNI anlık-soket-join'i burada da uygulanıyor - reconnect
  // beklemeden gerçek zamanlı teslimat.
  async joinRoom(userId: string, roomId: string): Promise<RoomSummary> {
    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      select: ROOM_SUMMARY_SELECT,
    });

    await this.prisma.roomMember.upsert({
      where: { userId_roomId: { userId, roomId } },
      create: { userId, roomId },
      update: {},
    });

    for (const socket of this.socketRegistry.getSockets(userId)) {
      await socket.join(roomId);
    }

    return room;
  }

  // Çekirdek odalar (CORE_ROOM_NAMES) AYRILAMAZ - herkesin ortak buluşma
  // noktası, yanlışlıkla ayrılmak (geri dönüşü olmasa bile - tekrar
  // keşfedilebilir-odalar üzerinden katılınabilir) kafa karıştırıcı bir
  // kenar durum için hiçbir gerçek talep yokken inşa edilmiş bir risk.
  // Zaten üye değilse idempotent (sessizce no-op) - `deleteMany` doğal
  // olarak bunu sağlıyor, ayrı bir "zaten değilsin" kontrolüne gerek yok.
  // Açık soketi ANINDA odadan çıkarıyor - aksi halde bir sonraki
  // reconnect'e kadar yayın almaya devam ederdi, "ayrılmanın" hiçbir
  // anlamı kalmazdı.
  async leaveRoom(userId: string, roomId: string): Promise<void> {
    const room = await this.prisma.room.findUniqueOrThrow({
      where: { id: roomId },
      select: { name: true },
    });
    if ((CORE_ROOM_NAMES as readonly string[]).includes(room.name)) {
      throw new ForbiddenException('Çekirdek bir odadan ayrılamazsın.');
    }

    await this.prisma.roomMember.deleteMany({ where: { userId, roomId } });

    for (const socket of this.socketRegistry.getSockets(userId)) {
      await socket.leave(roomId);
    }
  }

  // M3 Slice A: oluşturan kullanıcı zaten bağlıysa (normal durum - odayı
  // yaratmak için önce giriş yapmış olmaları gerekiyor), soketlerini yeni
  // odaya hemen katıyoruz - handleConnection'ın bağlantı-anındaki
  // join-all'ını beklemeden. MessagesGateway'e hiç dokunmuyor,
  // SocketRegistryService zaten bu kesişen-endişe için var (Slice D).
  async createRoom(
    userId: string,
    name: string,
    description?: string,
  ): Promise<RoomSummary> {
    // Case-insensitive ön kontrol - auth.service.ts'in username'de zaten
    // kurduğu aynı desen (DB'deki unique index case-sensitive, "General"
    // ve "general" birbirini engellemez tek başına). Ayrı bir
    // CORE_ROOM_NAMES kontrolüne gerek yok - çekirdek odalar zaten gerçek
    // satırlar, bu sorgu onları da kapsıyor.
    const existingRoom = await this.prisma.room.findFirst({
      where: { name: { equals: name, mode: 'insensitive' } },
    });
    if (existingRoom) {
      throw new ConflictException('Bu isimde bir oda zaten var.');
    }

    let room: RoomSummary;
    try {
      // M7a Slice B: nested create - kurucunun üyeliği Room satırıyla
      // ATOMIK olarak yaratılıyor (ADR-0009, createRoom'un ileriye dönük
      // otomatik-üyelik davranışı, backfill'in geriye dönük "oda kurucuları"
      // kaynağıyla simetrik).
      room = await this.prisma.room.create({
        data: {
          name,
          description,
          creatorId: userId,
          members: { create: { userId } },
        },
        select: ROOM_SUMMARY_SELECT,
      });
    } catch (error) {
      if (isUniqueConstraintError(error, 'name')) {
        throw new ConflictException('Bu isimde bir oda zaten var.');
      }
      throw error;
    }

    for (const socket of this.socketRegistry.getSockets(userId)) {
      await socket.join(room.id);
    }

    return room;
  }

  // `now` parametresi bu kod tabanında ilk kez kullanılan bir desen -
  // "kurulu convention" değil, bilerek eklendi (sadece birim testte kesim
  // matematiğini kontrol etmek için). Sweep endpoint'i bunu dışarıdan
  // enjekte etmiyor, her zaman gerçek saati kullanıyor.
  async archiveSilentRooms(
    now: Date = new Date(),
  ): Promise<{ archivedCount: number }> {
    const cutoff = new Date(now.getTime() - ARCHIVE_AFTER_MS);
    const result = await this.prisma.room.updateMany({
      where: {
        status: 'active',
        lastActivityAt: { lt: cutoff },
        name: { notIn: [...CORE_ROOM_NAMES] },
      },
      data: { status: 'archived', archivedAt: now },
    });
    return { archivedCount: result.count };
  }

  // ADR-0006: arşivlenmiş bir oda 60 gün sıfır görüntülenmeyle hard-delete
  // edilir - CLAUDE.md'nin "mesaj asla hard-delete edilmez" kuralına
  // kayıtlı bir istisna (ADR-0006 Addendum). Çekirdek odalar için ayrı bir
  // istisna filtresi gerekmiyor - archiveSilentRooms zaten onları hiçbir
  // zaman 'archived' durumuna getirmiyor, purge'ün girdisine hiç girmiyorlar.
  async purgeArchivedRooms(now: Date = new Date()): Promise<{
    deletedCount: number;
  }> {
    const cutoff = new Date(now.getTime() - DELETE_AFTER_MS);
    const candidateWhere = {
      status: 'archived' as const,
      archivedAt: { lt: cutoff },
    };

    const candidates = await this.prisma.room.findMany({
      where: candidateWhere,
      select: { id: true, archivedAt: true, lastViewedAt: true },
    });
    const eligibleIds = candidates.filter(isEligibleForPurge).map((r) => r.id);
    if (eligibleIds.length === 0) {
      return { deletedCount: 0 };
    }

    return this.prisma.$transaction(async (tx) => {
      // TOCTOU kapatma: yukarıdaki aday-seçme sorgusu ile buradaki silme
      // arasında biri odayı görüntülemiş olabilir (lastViewedAt
      // güncellenmiş) - silmeden hemen önce aynı uygunluk koşulunu
      // transaction içinde tekrar kontrol ediyoruz, pencereyi saatlik cron
      // döngüsünden aynı transaction içindeki milisaniyelere indiriyor.
      const recheck = await tx.room.findMany({
        where: { id: { in: eligibleIds }, ...candidateWhere },
        select: { id: true, archivedAt: true, lastViewedAt: true },
      });
      const finalIds = recheck.filter(isEligibleForPurge).map((r) => r.id);
      if (finalIds.length === 0) {
        return { deletedCount: 0 };
      }

      // Child->parent sırası zorunlu: Message/MessageEdit'in Room'a FK'si
      // RESTRICT, önce onlar gitmeden Room silinemez.
      await tx.messageEdit.deleteMany({
        where: { message: { roomId: { in: finalIds } } },
      });
      await tx.message.deleteMany({ where: { roomId: { in: finalIds } } });
      await tx.room.deleteMany({ where: { id: { in: finalIds } } });

      return { deletedCount: finalIds.length };
    });
  }
}

export function isUniqueConstraintError(
  error: unknown,
  field: string,
): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}
