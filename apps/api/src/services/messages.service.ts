import { Injectable, NotFoundException } from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { BlocksService } from './blocks.service';

export const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_PAGE_SIZE = 50;

export interface MessageDto {
  id: string;
  content: string;
  createdAt: Date;
  authorEmail: string | null;
  roomId: string;
}

export interface MessagePage {
  messages: MessageDto[];
  nextCursor: string | null;
}

interface MessageRow {
  id: string;
  content: string;
  createdAt: Date;
  roomId: string;
  author: { email: string } | null;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
  ) {}

  async sendMessage(
    userId: string,
    roomName: string,
    content: string,
  ): Promise<MessageDto> {
    const room = await this.findRoomOrThrow(roomName);

    const message = await this.prisma.message.create({
      data: { content, roomId: room.id, authorId: userId },
      include: { author: { select: { email: true } } },
    });

    return toMessageDto(message);
  }

  async getRecentMessages(
    roomName: string,
    requesterId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<MessagePage> {
    const room = await this.findRoomOrThrow(roomName);
    const blockedAuthorIds =
      await this.blocksService.getBlockedAuthorIds(requesterId);

    const rows = await this.prisma.message.findMany({
      where: {
        roomId: room.id,
        // authorId null'a asla dokunma: yazarı anonimleştirilmiş (silinmiş
        // hesap, ADR-0005) mesajlar herkese görünür kalmalı. Bare `notIn`
        // kullanmadık — SQL'in NOT IN + NULL semantiği sürpriz yapabilir,
        // bu açık OR aynı sonucu garanti eder.
        ...(blockedAuthorIds.length > 0
          ? {
              OR: [
                { authorId: null },
                { authorId: { notIn: blockedAuthorIds } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      include: { author: { select: { email: true } } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return {
      messages: page.reverse().map(toMessageDto),
      nextCursor,
    };
  }

  private async findRoomOrThrow(name: string): Promise<Room> {
    const room = await this.prisma.room.findUnique({ where: { name } });
    if (!room) {
      throw new NotFoundException(`Oda bulunamadı: ${name}`);
    }
    return room;
  }
}

function toMessageDto(message: MessageRow): MessageDto {
  return {
    id: message.id,
    content: message.content,
    createdAt: message.createdAt,
    authorEmail: message.author?.email ?? null,
    roomId: message.roomId,
  };
}
