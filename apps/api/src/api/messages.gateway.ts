import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../db/prisma.service';
import { CORE_ROOM_NAMES } from '../db/core-rooms.constants';
import { AuthService } from '../services/auth.service';
import {
  MAX_MESSAGE_LENGTH,
  MessagesService,
} from '../services/messages.service';
import type { MessageDto } from '../services/messages.service';
import { BlocksService } from '../services/blocks.service';
import { WsThrottlerGuard } from './ws-throttler.guard';

const MESSAGE_SEND_LIMIT = 10;
const MESSAGE_SEND_TTL_MS = 10 * 1000;

interface SocketData {
  userId: string;
}

@WebSocketGateway({
  cors: { origin: process.env.WEB_ORIGIN },
})
export class MessagesGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly messagesService: MessagesService,
    private readonly blocksService: BlocksService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.authService.verifyAccessToken(token);
      const rooms = await this.prisma.room.findMany({
        where: { name: { in: [...CORE_ROOM_NAMES] } },
      });

      if (rooms.length === 0) {
        client.disconnect(true);
        return;
      }

      const data: SocketData = { userId: payload.sub };
      client.data = data;
      for (const room of rooms) {
        await client.join(room.id);
      }
      // Baglanti+auth+join tamamlanmadan client mesaj gonderirse
      // client.data henuz set edilmemis olabilir (async handleConnection
      // yarisi) - bu yuzden client'a acik bir hazir sinyali veriyoruz.
      client.emit('ready');
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('message:send')
  @UseGuards(WsThrottlerGuard)
  @Throttle({
    default: { limit: MESSAGE_SEND_LIMIT, ttl: MESSAGE_SEND_TTL_MS },
  })
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { content?: unknown; roomName?: unknown },
  ): Promise<void> {
    const { userId } = client.data as SocketData;
    const content = body?.content;
    const roomName =
      typeof body?.roomName === 'string' ? body.roomName : CORE_ROOM_NAMES[0];

    if (
      typeof content !== 'string' ||
      content.trim().length === 0 ||
      content.length > MAX_MESSAGE_LENGTH
    ) {
      return;
    }

    let message: MessageDto;
    try {
      message = await this.messagesService.sendMessage(
        userId,
        roomName,
        content,
      );
    } catch {
      // Bilinmeyen/gecersiz roomName - sessizce yoksay, ayni icerik
      // dogrulamasindaki gibi (client'i guvenilir kabul etme).
      return;
    }

    await this.broadcastToRoom(message, userId, 'message:new');
  }

  @SubscribeMessage('message:edit')
  @UseGuards(WsThrottlerGuard)
  @Throttle({
    default: { limit: MESSAGE_SEND_LIMIT, ttl: MESSAGE_SEND_TTL_MS },
  })
  async handleMessageEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId?: unknown; content?: unknown },
  ): Promise<void> {
    const { userId } = client.data as SocketData;
    const messageId = body?.messageId;
    const content = body?.content;

    if (
      typeof messageId !== 'string' ||
      typeof content !== 'string' ||
      content.trim().length === 0 ||
      content.length > MAX_MESSAGE_LENGTH
    ) {
      return;
    }

    let message: MessageDto;
    try {
      message = await this.messagesService.editMessage(
        userId,
        messageId,
        content,
      );
    } catch {
      // Bilinmeyen mesaj ya da yazar degilsin - sessizce yoksay, ayni
      // message:send'deki gecersiz-girdi davranisi gibi.
      return;
    }

    await this.broadcastToRoom(message, userId, 'message:updated');
  }

  // Blanket oda broadcast'i yerine bilerek tek tek emit ediyoruz: bu
  // yazarı engellemiş kullanıcıların socket'lerine mesaj hiç ulaşmamalı
  // (block-user özelliği, M1 Slice D). message:send ve message:edit
  // ikisi de bunu kullanıyor.
  private async broadcastToRoom(
    message: MessageDto,
    authorId: string,
    eventName: string,
  ): Promise<void> {
    const blockerIds = new Set(
      await this.blocksService.getBlockerIdsOf(authorId),
    );
    const socketsInRoom = await this.server.in(message.roomId).fetchSockets();
    for (const socket of socketsInRoom) {
      const socketData = socket.data as SocketData;
      if (!blockerIds.has(socketData.userId)) {
        socket.emit(eventName, message);
      }
    }
  }
}
