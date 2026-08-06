import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import {
  ForbiddenException,
  GoneException,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
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
import { SocketRegistryService } from '../services/socket-registry.service';
import { getAllowedOrigins } from '../allowed-origins';

const MESSAGE_SEND_LIMIT = 10;
const MESSAGE_SEND_TTL_MS = 10 * 1000;

interface SocketData {
  userId: string;
}

interface AckResponse {
  status: 'ok';
}

@WebSocketGateway({
  cors: { origin: getAllowedOrigins(process.env.WEB_ORIGIN) },
})
export class MessagesGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  constructor(
    private readonly authService: AuthService,
    private readonly messagesService: MessagesService,
    private readonly blocksService: BlocksService,
    private readonly prisma: PrismaService,
    private readonly socketRegistry: SocketRegistryService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = client.handshake.auth?.token as string | undefined;

    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = await this.authService.verifyAccessToken(token);
      // M3 Slice A: eskiden sadece CORE_ROOM_NAMES'i sorguluyordu -
      // kullanıcı odaları hiç katılmıyordu, o odalarda gönderilen
      // mesajlar hiçbir bağlı sokete gerçek zamanlı ulaşmıyordu (kod
      // okuyarak bulunan bir açık, milestone'un Tasks listesinde hiç
      // yoktu). Artık tüm aktif odalara katılıyor.
      const rooms = await this.prisma.room.findMany({
        where: { status: 'active' },
      });

      if (rooms.length === 0) {
        client.disconnect(true);
        return;
      }

      const data: SocketData = { userId: payload.sub };
      client.data = data;
      this.socketRegistry.register(payload.sub, client);
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

  // Normal disconnect'lerde (sekme kapatma, ağ kopması) SocketRegistryService
  // Map'inin sınırsız büyümesini önler. Hesap silindiğinde
  // SocketRegistryService.disconnectUser zaten kendi kaydını temizliyor -
  // burası o durumda zararsız bir no-op.
  handleDisconnect(client: Socket): void {
    const data = client.data as SocketData | undefined;
    if (!data?.userId) return;
    this.socketRegistry.unregister(data.userId, client);
  }

  @SubscribeMessage('message:send')
  @UseGuards(WsThrottlerGuard)
  @Throttle({
    default: { limit: MESSAGE_SEND_LIMIT, ttl: MESSAGE_SEND_TTL_MS },
  })
  async handleMessageSend(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { content?: unknown; roomName?: unknown },
  ): Promise<AckResponse | void> {
    const { userId } = client.data as SocketData;
    const content = body?.content;
    const roomName =
      typeof body?.roomName === 'string' ? body.roomName : CORE_ROOM_NAMES[0];

    if (typeof content !== 'string' || content.trim().length === 0) {
      // Bos/gecersiz icerik gercek arayuzden hic ulasilamiyor (canSend
      // zaten engelliyor) - sessizce yoksay, client'i guvenilir kabul etme.
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      // Asil kontrol client-side (RoomView.tsx) - bu, o kontrolu atlayan
      // elle hazirlanmis bir client'a karsi ucuz bir yedek (ayni exception
      // altyapisi RATE_LIMITED icin zaten var).
      throw new WsException({ status: 'error', code: 'MESSAGE_TOO_LONG' });
    }

    let message: MessageDto;
    try {
      message = await this.messagesService.sendMessage(
        userId,
        roomName,
        content,
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        // Bilinmeyen/gecersiz roomName - sessizce yoksay, client'i
        // guvenilir kabul etme.
        return;
      }
      if (error instanceof GoneException) {
        // M3 Slice B: oda arşivlenmiş - RATE_LIMITED/MESSAGE_TOO_LONG ile
        // aynı yapısal hata deseni, client'ta "salt-okunur" mesajı gösterir.
        throw new WsException({ status: 'error', code: 'ROOM_ARCHIVED' });
      }
      // Beklenmeyen (ornegin yazarin User satiri artik yok - silinmis
      // kullanicinin soketi SocketRegistryService tarafindan proaktif
      // kapatildigi icin pratikte ulasilamaz olmasi hedefleniyor) -
      // varsayilan WS exception handler'ina dussun: loglanir VE client'a
      // 'exception' emit edilir, artik sessizce kaybolmaz.
      throw error;
    }

    await this.broadcastToRoom(message, userId, 'message:new');
    return { status: 'ok' };
  }

  @SubscribeMessage('message:edit')
  @UseGuards(WsThrottlerGuard)
  @Throttle({
    default: { limit: MESSAGE_SEND_LIMIT, ttl: MESSAGE_SEND_TTL_MS },
  })
  async handleMessageEdit(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId?: unknown; content?: unknown },
  ): Promise<AckResponse | void> {
    const { userId } = client.data as SocketData;
    const messageId = body?.messageId;
    const content = body?.content;

    if (
      typeof messageId !== 'string' ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      return;
    }
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new WsException({ status: 'error', code: 'MESSAGE_TOO_LONG' });
    }

    let message: MessageDto;
    try {
      message = await this.messagesService.editMessage(
        userId,
        messageId,
        content,
      );
    } catch (error) {
      if (error instanceof GoneException) {
        // M3 Slice B: oda arşivlenmiş - "yazarı değilsin" durumundan
        // BAĞIMSIZ, sessizce yutulmuyor (ROOM_ARCHIVED yapısal hatası
        // gösterilmeli, "yazarı değilsin" ise gösterilmiyor).
        throw new WsException({ status: 'error', code: 'ROOM_ARCHIVED' });
      }
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        // Bilinmeyen mesaj ya da yazar degilsin - sessizce yoksay, ayni
        // message:send'deki gecersiz-girdi davranisi gibi.
        return;
      }
      throw error;
    }

    await this.broadcastToRoom(message, userId, 'message:updated');
    return { status: 'ok' };
  }

  // Blanket oda broadcast'i yerine bilerek tek tek emit ediyoruz: bu
  // yazarı engellemiş kullanıcıların socket'lerine mesaj hiç ulaşmamalı
  // (block-user özelliği, M1 Slice D). message:send ve message:edit
  // ikisi de bunu kullanıyor.
  private async broadcastToRoom(
    message: MessageDto,
    authorId: string | null,
    eventName: string,
  ): Promise<void> {
    // authorId null olabilir (hesabı silinmiş/anonimleştirilmiş yazar,
    // ADR-0005) - engellenecek bir yazar yoksa filtre uygulanmaz.
    const blockerIds = authorId
      ? new Set(await this.blocksService.getBlockerIdsOf(authorId))
      : new Set<string>();
    const socketsInRoom = await this.server.in(message.roomId).fetchSockets();
    for (const socket of socketsInRoom) {
      const socketData = socket.data as SocketData;
      if (!blockerIds.has(socketData.userId)) {
        socket.emit(eventName, message);
      }
    }
  }

  // M5 Slice A: moderatör içerik kaldırma REST üzerinden çalışıyor
  // (ModerationController) ama oda WS ile canlı - handleMessageEdit'in
  // zaten kullandığı broadcastToRoom'u PUBLIC olarak dışarı açıyor,
  // ModerationController bunu çağırıyor. Yeni bir mekanizma değil, var
  // olanın REST'ten de tetiklenebilir hale gelmesi.
  async broadcastMessageUpdate(
    message: MessageDto,
    authorId: string | null,
  ): Promise<void> {
    await this.broadcastToRoom(message, authorId, 'message:updated');
  }
}
