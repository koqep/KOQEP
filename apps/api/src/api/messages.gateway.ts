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
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
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
import { hasExcessiveCombiningMarks } from '../services/content-validation.util';
import { UserMutedException } from '../services/user-muted.exception';
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
// M6 Slice B: APP_FILTER (app.module.ts) gateway'lere UYGULANMIYOR - Sentry
// hata yakalamasının WS tarafında da çalışması için ayrı bir dekoratör
// gerekiyor (SentryGlobalFilter'ın kendi kaynağı okunarak doğrulandı: ws
// context'inde WsException'ları AYNI şekilde client'a emit ediyor, sadece
// beklenmeyen hataları da Sentry'ye gönderiyor - davranış değişmiyor).
@UseFilters(new SentryGlobalFilter())
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
      // M7a Slice B: artık TÜM aktif odalara değil, SADECE üye olunan
      // (RoomMember) aktif odalara katılıyor - broadcastToRoom'un
      // server.in(roomId) çağrısı Socket.IO'nun bu join-state'ini okuyor,
      // üyelik-farkındalığı TAMAMEN burada, kimin join edildiğini
      // kontrol ederek elde ediliyor (broadcastToRoom'un kendisi
      // DEĞİŞMEDİ). Eskiden burada "sıfır aktif oda varsa disconnect et"
      // kontrolü vardı (M3 Slice A) - sistemde hiç aktif oda yoksa
      // anlamlıydı, ama üyelik-scoped sorguyla "BU KULLANICININ sıfır
      // üyeliği var mı" anlamına dönüşürdü: register()'dan ÖNCE
      // çalıştığı için sıfır-üyelikli (ör. henüz hiçbir odaya katılmamış,
      // keşfedilebilir odalara bakan) bir kullanıcı hiç register
      // edilmezdi - kendi join/mute/lifecycle bildirimlerini de kaçırırdı.
      // Kontrol TAMAMEN kaldırıldı: sıfır üyelik artık tutarlı, meşru bir
      // durum, register() koşulsuz çalışıyor.
      const memberships = await this.prisma.roomMember.findMany({
        where: { userId: payload.sub, room: { status: 'active' } },
        select: { roomId: true },
      });

      const data: SocketData = { userId: payload.sub };
      client.data = data;
      this.socketRegistry.register(payload.sub, client);
      for (const { roomId } of memberships) {
        await client.join(roomId);
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
    if (hasExcessiveCombiningMarks(content)) {
      // M7b Slice E: zalgo/birleşik-işaret koruması - THREAT-MODEL.md'nin
      // açık maddesi. handleMessageEdit'te de AYNI kontrol var - assertNotMuted
      // ile aynı gerekçe (M5 Slice B): sadece sendMessage'ı engellemek,
      // masum bir mesaj gönderip SONRA editMessage ile zalgo'ya çevirmeyi
      // (denetimi bypass etmeyi) mümkün kılardı.
      throw new WsException({
        status: 'error',
        code: 'MESSAGE_INVALID_CONTENT',
      });
    }

    let message: MessageDto;
    try {
      message = await this.messagesService.sendMessage(
        userId,
        roomName,
        content,
      );
    } catch (error) {
      if (error instanceof UserMutedException) {
        // M5 Slice B: susturulmuş kullanıcı - RATE_LIMITED/ROOM_ARCHIVED ile
        // aynı yapısal hata deseni, client'a görünür şekilde ulaşmalı
        // (acceptance criteria: "visibly notified").
        throw new WsException({
          status: 'error',
          code: 'MUTED',
          mutedUntil: error.mutedUntil.toISOString(),
        });
      }
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
    if (hasExcessiveCombiningMarks(content)) {
      throw new WsException({
        status: 'error',
        code: 'MESSAGE_INVALID_CONTENT',
      });
    }

    let message: MessageDto;
    try {
      message = await this.messagesService.editMessage(
        userId,
        messageId,
        content,
      );
    } catch (error) {
      if (error instanceof UserMutedException) {
        // M5 Slice B: sessiz yutulan ForbiddenException'dan (yazarı
        // değilsin) AYRI bir class - handleMessageSend'deki MUTED dalıyla
        // aynı yapısal hata.
        throw new WsException({
          status: 'error',
          code: 'MUTED',
          mutedUntil: error.mutedUntil.toISOString(),
        });
      }
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

  // M7b Slice D2: handleMessageEdit'in AYNI hata-eşleme deseni - zalgo/uzunluk
  // kontrolü GEREKMİYOR (sabit metin, kullanıcı girdisi yok). Yeni bir WS
  // event'i GEREKTİRMİYOR - mevcut message:updated'ı kullanıyor (frontend
  // zaten id'ye göre birleştiriyor).
  @SubscribeMessage('message:delete')
  @UseGuards(WsThrottlerGuard)
  @Throttle({
    default: { limit: MESSAGE_SEND_LIMIT, ttl: MESSAGE_SEND_TTL_MS },
  })
  async handleMessageDelete(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { messageId?: unknown },
  ): Promise<AckResponse | void> {
    const { userId } = client.data as SocketData;
    const messageId = body?.messageId;

    if (typeof messageId !== 'string') {
      return;
    }

    let message: MessageDto;
    try {
      message = await this.messagesService.deleteOwnMessage(userId, messageId);
    } catch (error) {
      if (error instanceof GoneException) {
        throw new WsException({ status: 'error', code: 'ROOM_ARCHIVED' });
      }
      if (
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
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

  // M5 Slice B: broadcastMessageUpdate'in AYNI REST->WS kompozisyon deseni,
  // ama oda broadcast'i DEĞİL - SocketRegistryService.getSockets(userId)
  // (M2.5 Slice D, bağımlılıksız) ile SADECE hedeflenen kullanıcının açık
  // soketlerine doğrudan emit. Senkron - fetchSockets()'in aksine
  // getSockets() gerçekten async değil. Kullanıcının o an hiç açık soketi
  // yoksa (ör. handleConnection'ın register() adımını henüz tamamlamadan
  // önceki dar yarış penceresi) push sessizce kaçar - zararsız, enforcement
  // (messages.service.ts) her zaman DB'den taze mutedUntil okuyor, bu
  // sadece bir bildirim kolaylığı, güvenlik sınırı değil.
  notifyUserMuted(userId: string, mutedUntil: Date, reason: string): void {
    for (const socket of this.socketRegistry.getSockets(userId)) {
      socket.emit('moderation:muted', {
        mutedUntil: mutedUntil.toISOString(),
        reason,
      });
    }
  }

  notifyUserUnmuted(userId: string): void {
    for (const socket of this.socketRegistry.getSockets(userId)) {
      socket.emit('moderation:unmuted', {});
    }
  }

  // M7b Slice D2: notifyUserMuted'ın AYNI hedefe-özel deseni - oda-geneli
  // broadcastMessageUpdate'in (herkes placeholder metni görür) AYRI, SADECE
  // yazara giden bir bildirim. authorId null olabilir (hesabı silinmiş/
  // anonimleştirilmiş yazar, ADR-0005) - hedef yoksa sessizce no-op.
  notifyContentRemoved(authorId: string | null, reason: string): void {
    if (!authorId) return;
    for (const socket of this.socketRegistry.getSockets(authorId)) {
      socket.emit('moderation:content-removed', { reason });
    }
  }

  // M7a Slice C: notifyUserMuted'in AYNI kişi-başı deseni - kaçırılan bir
  // push (hedef o an bağlı değil) zararsız, ModeratorGuard HER istekte
  // rolü DB'den taze okuyor, soket/JWT state'ine hiç güvenmiyor. Rolü
  // değişen kullanıcı ilgili UI'ı bir sonraki reconnect'e kadar görmeyebilir
  // ama attığı herhangi bir API çağrısı zaten anında doğru şekilde
  // çalışır/reddedilir. Assign VE revoke için TEK metod (role parametresi
  // ayrıştırıyor) - iki ayrı event adı gerekmiyor.
  notifyModeratorRoleChanged(userId: string, role: 'moderator' | 'user'): void {
    for (const socket of this.socketRegistry.getSockets(userId)) {
      socket.emit('moderation:role-changed', { role });
    }
  }

  // M5 Slice D, M7a Slice B'de GÜNCELLENDİ: oda-geneli bir olay
  // (rename/archive/delete), engellenen-yazar filtrelemesi burada anlamsız
  // (mesaj içeriğiyle ilgili değil, HERKES bilmeli) - keşfedilebilir-odalar
  // listesini ÜYE OLMAYANLAR için de etkiliyor. Üyelik-scoped join'den
  // (handleConnection artık SADECE üye olunan odalara join ediyor) sonra
  // server.in(roomId) SADECE üyelere ulaşırdı, "HERKES bilmeli" niyetini
  // sessizce bozardı - bu yüzden server.in(roomId) YERİNE
  // SocketRegistryService'in TÜM bağlı soket kaydı kullanılıyor, gerçek bir
  // global broadcast.
  notifyRoomRenamed(roomId: string, name: string): void {
    for (const socket of this.socketRegistry.getAllSockets()) {
      socket.emit('room:renamed', { roomId, name });
    }
  }

  notifyRoomArchived(roomId: string): void {
    for (const socket of this.socketRegistry.getAllSockets()) {
      socket.emit('room:archived', { roomId });
    }
  }

  notifyRoomDeleted(roomId: string): void {
    for (const socket of this.socketRegistry.getAllSockets()) {
      socket.emit('room:deleted', { roomId });
    }
  }

  // M7b Slice H2: notifyRoomRenamed'ın AYNI global-broadcast deseni ve
  // gerekçesi.
  notifyRoomAnnouncementUpdated(
    roomId: string,
    announcement: string | null,
  ): void {
    for (const socket of this.socketRegistry.getAllSockets()) {
      socket.emit('room:announcement-updated', { roomId, announcement });
    }
  }
}
