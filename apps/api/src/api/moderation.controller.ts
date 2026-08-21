import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReportsService, ReportSummary } from '../services/reports.service';
import { MutesService } from '../services/mutes.service';
import { RoomModerationService } from '../services/room-moderation.service';
import {
  ModeratorRoleService,
  ModeratorRoleResult,
} from '../services/moderator-role.service';
import { RoomSummary } from '../services/rooms.service';
import { MessagesGateway } from './messages.gateway';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { ModeratorGuard } from './moderator.guard';
import { MuteUserDto } from './dto/mute-user.dto';
import { RemoveContentDto } from './dto/remove-content.dto';
import { RenameRoomDto } from './dto/rename-room.dto';
import { SetRoomAnnouncementDto } from './dto/set-room-announcement.dto';
import { AssignModeratorDto } from './dto/assign-moderator.dto';
import { RevokeModeratorDto } from './dto/revoke-moderator.dto';

@Controller('moderation')
@UseGuards(JwtAuthGuard, ModeratorGuard)
export class ModerationController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly mutesService: MutesService,
    private readonly roomModerationService: RoomModerationService,
    private readonly moderatorRoleService: ModeratorRoleService,
    private readonly messagesGateway: MessagesGateway,
  ) {}

  @Get('reports')
  listOpenReports(@Req() req: AuthenticatedRequest): Promise<ReportSummary[]> {
    return this.reportsService.listOpenReports(req.user.sub);
  }

  @Post('reports/:id/remove-content')
  async removeContent(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RemoveContentDto,
  ): Promise<{ ok: true }> {
    const { dto: messageDto, authorId } =
      await this.reportsService.removeContent(req.user.sub, id, dto.reason);
    // M5 Slice A: REST -> WS broadcast, bu kod tabanında ilk kez, controller
    // katmanında (servis gateway'e bağımlı OLMUYOR) - moderatör içerik
    // kaldırmayı REST üzerinden yapıyor ama oda WS ile canlı, diğer
    // katılımcılar refresh olmadan güncellemeyi görmeli.
    await this.messagesGateway.broadcastMessageUpdate(messageDto, authorId);
    // M7b Slice D2: broadcastMessageUpdate'in AYRI, hedefe-özel eşleniği -
    // SADECE yazara "neden" bilgisini taşıyor.
    this.messagesGateway.notifyContentRemoved(authorId, dto.reason);
    return { ok: true };
  }

  @Post('reports/:id/dismiss')
  async dismiss(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.reportsService.dismiss(req.user.sub, id);
    return { ok: true };
  }

  // M5 Slice B: rapor yaşam döngüsünden BAĞIMSIZ (bkz. MutesService yorumu)
  // - bir rapor satırından hem "içeriği kaldır" HEM "sustur" tıklanabilsin
  // diye Report.status'a hiç dokunmuyor.
  @Post('users/:id/mute')
  async muteUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: MuteUserDto,
  ): Promise<{ mutedUntil: Date }> {
    const { mutedUntil } = await this.mutesService.applyMute(
      req.user.sub,
      id,
      dto.durationHours,
      dto.reason,
    );
    this.messagesGateway.notifyUserMuted(id, mutedUntil, dto.reason);
    return { mutedUntil };
  }

  @Post('users/:id/unmute')
  async unmuteUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.mutesService.liftMute(req.user.sub, id);
    this.messagesGateway.notifyUserUnmuted(id);
    return { ok: true };
  }

  // M5 Slice D: removeContent/mute'un AYNI REST->WS kompozisyon deseni.
  @Post('rooms/:id/rename')
  async renameRoom(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: RenameRoomDto,
  ): Promise<RoomSummary> {
    const room = await this.roomModerationService.renameRoom(
      req.user.sub,
      id,
      dto.name,
    );
    this.messagesGateway.notifyRoomRenamed(id, dto.name);
    return room;
  }

  @Post('rooms/:id/archive')
  async archiveRoom(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<RoomSummary> {
    const room = await this.roomModerationService.archiveRoom(req.user.sub, id);
    this.messagesGateway.notifyRoomArchived(id);
    return room;
  }

  @Post('rooms/:id/delete')
  async deleteRoom(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<{ ok: true }> {
    await this.roomModerationService.deleteRoom(req.user.sub, id);
    this.messagesGateway.notifyRoomDeleted(id);
    return { ok: true };
  }

  // M7b Slice H2: rename'in AYNI REST->WS kompozisyon deseni.
  @Post('rooms/:id/announcement')
  async setRoomAnnouncement(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: SetRoomAnnouncementDto,
  ): Promise<RoomSummary> {
    const room = await this.roomModerationService.setRoomAnnouncement(
      req.user.sub,
      id,
      dto.announcement,
    );
    this.messagesGateway.notifyRoomAnnouncementUpdated(id, room.announcement);
    return room;
  }

  // M7a Slice C: mute/rename'in AYNI REST->WS kompozisyon deseni. Path
  // `:id` DEĞİL, body `email` - hedef bu controller'ın diğer route'larının
  // aksine (zaten seçilmiş bir id ile başlıyorlar) moderatörün YAZDIĞI bir
  // email'le başlıyor, BlocksController'ın POST /users/block deseni.
  @Post('users/assign-moderator')
  async assignModerator(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AssignModeratorDto,
  ): Promise<ModeratorRoleResult & { alreadyModerator: boolean }> {
    const result = await this.moderatorRoleService.assignModerator(
      req.user.sub,
      dto.password,
      dto.totpCode,
      dto.email,
    );
    this.messagesGateway.notifyModeratorRoleChanged(result.id, 'moderator');
    return result;
  }

  @Post('users/revoke-moderator')
  async revokeModerator(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RevokeModeratorDto,
  ): Promise<ModeratorRoleResult & { wasNotModerator: boolean }> {
    const result = await this.moderatorRoleService.revokeModerator(
      req.user.sub,
      dto.email,
    );
    this.messagesGateway.notifyModeratorRoleChanged(result.id, 'user');
    return result;
  }
}
