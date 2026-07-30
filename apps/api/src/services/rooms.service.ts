import { Injectable } from '@nestjs/common';
import { PrismaService } from '../db/prisma.service';

export interface RoomSummary {
  id: string;
  name: string;
}

@Injectable()
export class RoomsService {
  constructor(private readonly prisma: PrismaService) {}

  async listRooms(): Promise<RoomSummary[]> {
    return this.prisma.room.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }
}
