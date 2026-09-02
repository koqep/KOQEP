import {
  ForbiddenException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Room } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { BlocksService } from './blocks.service';
import {
  ReputationService,
  MESSAGE_SENT_ACTION,
  MESSAGE_SENT_XP,
} from './reputation.service';
import { InvitesService } from './invites.service';
import { UserMutedException } from './user-muted.exception';

export const MAX_MESSAGE_LENGTH = 2000;
const DEFAULT_PAGE_SIZE = 50;
// M7a Slice J: Room.lastActivityAt'i sendMessage'ın transaction'ından
// çıkarıp ateşle-unut yapınca, aynı odaya (özellikle CORE_ROOM_NAMES)
// yüksek eşzamanlılıkta yazan istekler artık AYNI satırı tek-tek her
// mesajda güncellemeye çalışmıyor - bu pencere içindeki TÜM yazımlar
// tek bir gerçek UPDATE'e düşüyor. archiveSilentRooms'un (rooms.service.ts)
// 14-GÜNLÜK eşiğine karşı 30sn ihmal edilebilir; CORE_ROOM_NAMES zaten o
// sweep'in kapsamı dışı (name NOT IN CORE_ROOM_NAMES).
const ROOM_ACTIVITY_DEBOUNCE_MS = 30_000;
export const MODERATOR_REMOVED_CONTENT =
  '[Bu mesaj bir moderatör tarafından kaldırıldı.]';
// M7b Slice D2: deleteOwnMessage'ın sabit placeholder'ı -
// MODERATOR_REMOVED_CONTENT'in AYNI deseni (ADR-0005'in "asla hard-delete"
// kuralına tutarlı soft-delete).
export const AUTHOR_DELETED_CONTENT = '[Bu mesaj yazarı tarafından silindi.]';

export interface MessageDto {
  id: string;
  content: string;
  createdAt: Date;
  authorUsername: string | null;
  roomId: string;
  // M7b Slice D2: "(düzenlendi)" göstergesi - SADECE editMessage set eder.
  editedAt: Date | null;
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
  editedAt: Date | null;
}

@Injectable()
export class MessagesService {
  private readonly logger = new Logger(MessagesService.name);
  // M7a Slice J: roomId -> son GERÇEK Room.update çağrısının epoch-ms'i.
  // Tek-process (ADR-0003, "monolith-first") ömrü boyunca yaşıyor - ikinci
  // bir instance'a geçilirse (founder'ın kendi açık kararı,
  // M7a-scale-gate.md'nin Slice J notu) her instance kendi Map'ini tutar,
  // debounce ZAYIFLAR (kırılmaz, N-instance kadar eşzamanlı yazıma iner).
  private readonly lastActivityWrites = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly blocksService: BlocksService,
    private readonly reputationService: ReputationService,
    private readonly invitesService: InvitesService,
  ) {}

  async sendMessage(
    userId: string,
    roomName: string,
    content: string,
  ): Promise<MessageDto> {
    await this.assertNotMuted(userId);
    const room = await this.findRoomOrThrow(roomName);
    await this.assertRoomAccessOrThrow(room, userId);
    if (room.status !== 'active') {
      // M3 Slice B: "arşivlenince salt-okunur" - sendMessage bugüne kadar
      // oda durumunu hiç kontrol etmiyordu.
      throw new GoneException('Bu oda arşivlenmiş, sadece okunabilir.');
    }

    const message = await this.prisma.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { content, roomId: room.id, authorId: userId },
        include: { author: { select: { username: true } } },
      });
      // M4 Slice A: ADR-0004'ün itibar günlüğü - mesaj gönderimi XP
      // kazandırıyor, aynı transaction içinde (mesaj var ama olayı yoksa
      // günlük tutarsız kalırdı).
      const { oldLevel, newLevel } = await this.reputationService.awardXp(
        tx,
        userId,
        MESSAGE_SENT_ACTION,
        MESSAGE_SENT_XP,
        created.id,
      );
      // M4 Slice B: seviye atlayınca 1 davet/seviye kazanılır (bir mesaj
      // birden fazla seviye atlatabilir - bkz. reputation.service.ts).
      // Aynı transaction'da, XP yazımıyla atomik.
      if (newLevel > oldLevel) {
        await this.invitesService.grantInvites(tx, userId, newLevel - oldLevel);
      }
      return created;
    });

    // M7a Slice J: Room.lastActivityAt GÜNCELLEMESİ artık transaction'ın
    // İÇİNDE DEĞİL - yük testinde (Slice I) aynı odaya eşzamanlı yazan
    // yüzlerce istek bu satırın kilidinde çakışıp "Unable to start a
    // transaction in the given time" hatası veriyordu (100 bağlantıda
    // bile başlıyordu). MessageDto SADECE `created`'dan türüyor (bkz.
    // toMessageDto), Room.update'in sonucuna hiç bağlı değildi - transaction
    // dışına almak API'nin döndürdüğü veriyi DEĞİŞTİRMİYOR. `void` ile
    // ateşle-unut (yanıt yolunu bloklamıyor) + debounce (touchRoomActivity).
    void this.touchRoomActivity(room.id);

    return toMessageDto(message);
  }

  // M3 Slice A: Room.lastActivityAt güncellenmezse Slice B'nin 14-gün-
  // sessizlik arşivleme süpürmesi HER odayı aktiviteden bağımsız tam 14
  // günde arşivlerdi. Bu metot AuthService.sendLockoutNotification'ın
  // (M7a Slice F) AYNI ateşle-unut desenini kullanıyor - kendi try/catch'i,
  // hata çağırana hiç sızmıyor. AuthService'in aksine buradaki debounce
  // state'i DB-kalıcı değil (in-memory) - bu yüzden hata durumunda `catch`
  // içinde map'ten SİLİNİYOR, aksi halde geçici bir DB hatası sonraki
  // mesajları da 30sn boyunca sessizce bloklardı.
  private async touchRoomActivity(roomId: string): Promise<void> {
    const now = Date.now();
    const lastWrite = this.lastActivityWrites.get(roomId);
    if (
      lastWrite !== undefined &&
      now - lastWrite < ROOM_ACTIVITY_DEBOUNCE_MS
    ) {
      return;
    }
    this.lastActivityWrites.set(roomId, now);
    try {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { lastActivityAt: new Date(now) },
      });
    } catch (error) {
      this.lastActivityWrites.delete(roomId);
      this.logger.error(
        `Room.lastActivityAt güncellenemedi (roomId=${roomId}): ${(error as Error).message}`,
      );
    }
  }

  async getRecentMessages(
    roomName: string,
    requesterId: string,
    cursor?: string,
    limit: number = DEFAULT_PAGE_SIZE,
  ): Promise<MessagePage> {
    const room = await this.findRoomOrThrow(roomName);
    await this.assertRoomAccessOrThrow(room, requesterId);
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
    // M5 Slice B: susturma HEM gönderim HEM düzenlemeyi kapsıyor - sadece
    // sendMessage'ı engellemek, susturulmuş birinin eski (susturma öncesi)
    // bir mesajını saldırgan içeriğe çevirerek bypass etmesine izin verirdi
    // (docs/THREAT-MODEL.md satır 3).
    await this.assertNotMuted(userId);
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
        data: { content, editedAt: new Date() },
        include: { author: { select: { username: true } } },
      });
    });

    return toMessageDto(updated);
  }

  // M7b Slice D2: editMessage'ın AYNI iskeleti (yazar/oda kontrolü,
  // MessageEdit snapshot) - TEK fark assertNotMuted YOK: mute koruması
  // "susturulmuş biri eski bir mesajı saldırgan içeriğe çevirebilir"
  // riskine karşı (M5 Slice B), silme YENİ içerik EKLEMİYOR, sabit bir
  // placeholder'a değiştiriyor - aynı risk yok, susturulmuş biri kendi
  // mesajını silebilmeli. editedAt BİLEREK set EDİLMİYOR - placeholder
  // metnin kendisi zaten "yazarı tarafından silindi" diyor.
  async deleteOwnMessage(
    userId: string,
    messageId: string,
  ): Promise<MessageDto> {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      include: { room: { select: { status: true } } },
    });
    if (!message) {
      throw new NotFoundException(`Mesaj bulunamadı: ${messageId}`);
    }
    if (message.room.status !== 'active') {
      throw new GoneException('Bu oda arşivlenmiş, sadece okunabilir.');
    }
    if (message.authorId !== userId) {
      throw new ForbiddenException('Sadece kendi mesajını silebilirsin.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.messageEdit.create({
        data: { messageId, previousContent: message.content },
      });
      return tx.message.update({
        where: { id: messageId },
        data: { content: AUTHOR_DELETED_CONTENT },
        include: { author: { select: { username: true } } },
      });
    });

    return toMessageDto(updated);
  }

  // M5 Slice A: editMessage'ın MessageEdit-yazma deseniyle AYNI (orijinal
  // içerik MessageEdit'e taşınır) ama yazar kontrolü YOK - bu metot sadece
  // ReportsService.removeContent'ten, zaten ModeratorGuard arkasından
  // çağrılıyor. CLAUDE.md'nin "mesaj içeriği asla hard-delete edilmez"
  // kuralına uyuyor - Message satırı silinmiyor, içeriği değişiyor. Oda
  // durumu (arşiv) BİLEREK kontrol edilmiyor - "salt-okunur" kısıtlaması
  // sıradan kullanıcı yazımı için, moderatör aksiyonu odanın durumundan
  // bağımsız çalışmalı.
  //
  // awardXp/grantInvites (M4) ile AYNI desen: kendi transaction'ını
  // AÇMIYOR, çağıranın açık tx'ini alıyor - ReportsService.removeContent
  // bunu Report.status güncellemesi + ModerationAuditLog yazımıyla TEK
  // atomik transaction'a komponse edebilsin diye (mesaj içeriği değişti
  // ama rapor hâlâ "açık" görünen bir ara durum olmasın).
  async removeMessageContent(
    tx: Prisma.TransactionClient,
    messageId: string,
  ): Promise<{ dto: MessageDto; authorId: string | null }> {
    const message = await tx.message.findUnique({ where: { id: messageId } });
    if (!message) {
      throw new NotFoundException(`Mesaj bulunamadı: ${messageId}`);
    }

    await tx.messageEdit.create({
      data: { messageId, previousContent: message.content },
    });
    const updated = await tx.message.update({
      where: { id: messageId },
      data: { content: MODERATOR_REMOVED_CONTENT },
      include: { author: { select: { username: true } } },
    });

    return { dto: toMessageDto(updated), authorId: updated.authorId };
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
      // M5 Slice A: docs/THREAT-MODEL.md satır 12 "scoped to an active
      // report" diyordu ama Report hiç yokken bu doğrulanamaz bir iddiaydı
      // - şimdi gerçek hale getiriliyor. Rapor DURUMU önemsiz (çözülmüş bir
      // rapor bile geçmiş bir vaka olarak incelenebilmeli), sadece bu
      // mesaja ait EN AZ BİR rapor olması yeterli.
      const hasReport = await this.prisma.report.findFirst({
        where: { messageId },
        select: { id: true },
      });
      if (!hasReport) {
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

  // sendMessage/editMessage'ın ikisi de - M5 Slice B, "tam kapsam" talebi.
  // User.mutedUntil canlı okunuyor (totalXp/level ile aynı önbellek deseni) -
  // mutedUntil geçmişte/null ise sessizce izin verilir, ayrıca sıfırlanmaz
  // (pasif sona ermeye tepki veren bir moderatör aksiyonu yok, kaydedecek
  // bir şey de yok).
  private async assertNotMuted(userId: string): Promise<void> {
    const requester = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mutedUntil: true },
    });
    if (requester?.mutedUntil && requester.mutedUntil > new Date()) {
      throw new UserMutedException(requester.mutedUntil);
    }
  }

  // M11c Slice A: kod tabanına eklenen İLK gerçek erişim-gating - şifresiz
  // odalarda (bugün TÜMÜ) sıfır ek sorgu/davranış değişikliği, room.
  // passwordHash doluysa RoomMember şart koşuyor (bir kez şifreyle
  // kanıtlanmış üyelik - joinRoom, rooms.service.ts). WS handleMessageSend
  // bu ForbiddenException'ı ROOM_ACCESS_DENIED'a çeviriyor (messages.
  // gateway.ts); REST getRecentMessages'ta Nest'in varsayılan exception
  // filter'ı doğal 403'e çeviriyor.
  private async assertRoomAccessOrThrow(
    room: Room,
    userId: string,
  ): Promise<void> {
    if (!room.passwordHash) return;
    const membership = await this.prisma.roomMember.findUnique({
      where: { userId_roomId: { userId, roomId: room.id } },
    });
    if (!membership) {
      throw new ForbiddenException('Bu oda şifre korumalı, önce katılmalısın.');
    }
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
    editedAt: message.editedAt,
  };
}
