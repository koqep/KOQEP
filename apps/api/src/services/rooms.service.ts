import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, RoomStatus } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { SocketRegistryService } from './socket-registry.service';
import { CORE_ROOM_NAMES } from '../db/core-rooms.constants';

const ARCHIVE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const DELETE_AFTER_MS = 60 * 24 * 60 * 60 * 1000;

export interface RoomSummary {
  id: string;
  name: string;
  description: string | null;
  lastActivityAt: Date;
  status: RoomStatus;
}

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
  async listRooms(includeArchived = false): Promise<RoomSummary[]> {
    return this.prisma.room.findMany({
      where: {
        status: includeArchived ? { in: ['active', 'archived'] } : 'active',
      },
      select: {
        id: true,
        name: true,
        description: true,
        lastActivityAt: true,
        status: true,
      },
      orderBy: { name: 'asc' },
    });
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
      room = await this.prisma.room.create({
        data: { name, description, creatorId: userId },
        select: {
          id: true,
          name: true,
          description: true,
          lastActivityAt: true,
          status: true,
        },
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
