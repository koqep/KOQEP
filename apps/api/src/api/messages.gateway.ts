import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../db/prisma.service';
import { DEV_ROOM_NAME } from '../db/dev-seed.constants';
import { AuthService } from '../services/auth.service';
import {
  MAX_MESSAGE_LENGTH,
  MessagesService,
} from '../services/messages.service';
import { BlocksService } from '../services/blocks.service';

interface SocketData {
  userId: string;
  roomId: string;
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
      const room = await this.prisma.room.findUnique({
        where: { name: DEV_ROOM_NAME },
      });

      if (!room) {
        client.disconnect(true);
        return;
      }

      const data: SocketData = { userId: payload.sub, roomId: room.id };
      client.data = data;
      await client.join(room.id);
      // Baglanti+auth+join tamamlanmadan client mesaj gonderirse
      // client.data henuz set edilmemis olabilir (async handleConnection
      // yarisi) - bu yuzden client'a acik bir hazir sinyali veriyoruz.
      client.emit('ready');
    } catch {
      client.disconnect(true);
    }
  }

  @SubscribeMessage('message:send')
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { content?: unknown },
  ): Promise<void> {
    const { userId, roomId } = client.data as SocketData;
    const content = body?.content;

    if (
      typeof content !== 'string' ||
      content.trim().length === 0 ||
      content.length > MAX_MESSAGE_LENGTH
    ) {
      return;
    }

    const message = await this.messagesService.sendMessage(userId, content);

    // Blanket oda broadcast'i yerine bilerek tek tek emit ediyoruz: bu
    // yazarı engellemiş kullanıcıların socket'lerine mesaj hiç ulaşmamalı
    // (block-user özelliği, M1 Slice D).
    const blockerIds = new Set(
      await this.blocksService.getBlockerIdsOf(userId),
    );
    const socketsInRoom = await this.server.in(roomId).fetchSockets();
    for (const socket of socketsInRoom) {
      const socketData = socket.data as SocketData;
      if (!blockerIds.has(socketData.userId)) {
        socket.emit('message:new', message);
      }
    }
  }
}
