import {
  ForbiddenException,
  GoneException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Room } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { BlocksService } from './blocks.service';
import {
  ReputationService,
  MESSAGE_SENT_ACTION,
  MESSAGE_SENT_XP,
} from './reputation.service';

export const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_PAGE_SIZE = 50;

export interface MessageDto {
  id: string;
  content: string;
  createdAt: Date;
  authorUsername: string | null;
  roomId: string;
}

export interface MessagePage {
  messages: MessageDto[];
  nextCursor: string | null;
}

export interface MessageEditDto {
  previousContent: string;
  editedAt: Date;
}

interface MessageRow {
  id: string;
  content: string;
  createdAt: Date;
  roomId: string;
  author: { username: string } | null;
}

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly reputationService: ReputationService,
  ) {}

  async sendMessage(
    userId: string,
    roomName: string,
    content: string,
  ): Promise<MessageDto> {
    const room = await this.findRoomOrThrow(roomName);
    if (room.status !== 'active') {
      // M3 Slice B: "arşivlenince salt-okunur" - sendMessage bugüne kadar
      // oda durumunu hiç kontrol etmiyordu.
      throw new GoneException('Bu oda arşivlenmiş, sadece okunabilir.');
    }

    // M3 Slice A: Room.lastActivityAt burada güncellenmezse, Slice B'nin
    // 14-gün-sessizlik arşivleme süpürmesi HER odayı aktiviteden bağımsız
    // tam 14 günde arşivlerdi (2. tur kapsam gözden geçirmesinde bulunan
    // sessiz bir açık).
    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { content, roomId: room.id, authorId: userId },
        include: { author: { select: { username: true } } },
      });
      await tx.room.update({
        where: { id: room.id },
        data: { lastActivityAt: new Date() },
      });
      // M4 Slice A: ADR-0004'ün itibar günlüğü - mesaj gönderimi XP
      // kazandırıyor, aynı transaction içinde (mesaj var ama olayı yoksa
      // günlük tutarsız kalırdı).
      await this.reputationService.awardXp(
        tx,
        userId,
        MESSAGE_SENT_ACTION,
        MESSAGE_SENT_XP,
        created.id,
      );
      return created;
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
    if (room.status === 'archived') {
      // M3 Slice C: purgeArchivedRooms'un 60-gün-sıfır-görüntülenme
      // hesaplaması bu alana bakıyor - SADECE arşivlenmiş odalarda
      // yazıyoruz, her #general geçmiş çekişinde yazmak $50/mo Postgres'te
      // gereksiz. updateMany (update DEĞİL) - sweep bu odayı aynı anda
      // silmiş olabilir, updateMany sıfır eşleşmede sessizce no-op olur.
      await this.prisma.room.updateMany({
        where: { id: room.id },
        data: { lastViewedAt: new Date() },
      });
    }
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
      include: { author: { select: { username: true } } },
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? page[page.length - 1].id : null;

    return {
      messages: page.reverse().map(toMessageDto),
      nextCursor,
    };
  }

  async editMessage(
    userId: string,
    messageId: string,
    content: string,
  ): Promise<MessageDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { room: { select: { status: true } } },
    });
    if (!message) {
      throw new NotFoundException(`Mesaj bulunamadı: ${messageId}`);
    }
    if (message.room.status !== 'active') {
      // M3 Slice B: editMessage bugüne kadar oda durumunu hiç kontrol
      // etmiyordu - sadece sendMessage'ı engellemek "yeni mesaj yasak ama
      // düzenleme serbest" bırakırdı, "salt-okunur" değil.
      throw new GoneException('Bu oda arşivlenmiş, sadece okunabilir.');
    }
    if (message.authorId !== userId) {
      throw new ForbiddenException('Sadece kendi mesajını düzenleyebilirsin.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.messageEdit.create({
        data: { messageId, previousContent: message.content },
      });
      return tx.message.update({
        where: { id: messageId },
        data: { content },
        include: { author: { select: { username: true } } },
      });
    });

    return toMessageDto(updated);
  }

  async getMessageEditHistory(
    requesterId: string,
    messageId: string,
  ): Promise<MessageEditDto[]> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });
    if (!message) {
      throw new NotFoundException(`Mesaj bulunamadı: ${messageId}`);
    }

    const isAuthor = message.authorId === requesterId;
    if (!isAuthor) {
      const requester = await this.prisma.user.findUnique({
        where: { id: requesterId },
        select: { role: true },
      });
      if (requester?.role !== 'moderator') {
        throw new ForbiddenException(
          'Bu mesajın düzenleme geçmişini görme yetkin yok.',
        );
      }
    }

    const edits = await this.prisma.messageEdit.findMany({
      where: { messageId },
      orderBy: { editedAt: 'asc' },
    });

    return edits.map((edit) => ({
      previousContent: edit.previousContent,
      editedAt: edit.editedAt,
    }));
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
    authorUsername: message.author?.username ?? null,
    roomId: message.roomId,
  };
}
