import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { SocketRegistryService } from './socket-registry.service';

export interface RoomSummary {
  id: string;
  name: string;
  description: string | null;
  lastActivityAt: Date;
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketRegistry: SocketRegistryService,
  ) {}

  async listRooms(): Promise<RoomSummary[]> {
    return this.prisma.room.findMany({
      select: { id: true, name: true, description: true, lastActivityAt: true },
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
}

function isUniqueConstraintError(error: unknown, field: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    Array.isArray(error.meta?.target) &&
    (error.meta.target as string[]).includes(field)
  );
}
