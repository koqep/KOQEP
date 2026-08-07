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
import { MessagesGateway } from './messages.gateway';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { ModeratorGuard } from './moderator.guard';
import { MuteUserDto } from './dto/mute-user.dto';

@Controller('moderation')
@UseGuards(JwtAuthGuard, ModeratorGuard)
export class ModerationController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly mutesService: MutesService,
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
  ): Promise<{ ok: true }> {
    const { dto, authorId } = await this.reportsService.removeContent(
      req.user.sub,
      id,
    );
    // M5 Slice A: REST -> WS broadcast, bu kod tabanında ilk kez, controller
    // katmanında (servis gateway'e bağımlı OLMUYOR) - moderatör içerik
    // kaldırmayı REST üzerinden yapıyor ama oda WS ile canlı, diğer
    // katılımcılar refresh olmadan güncellemeyi görmeli.
    await this.messagesGateway.broadcastMessageUpdate(dto, authorId);
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
    );
    this.messagesGateway.notifyUserMuted(id, mutedUntil);
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
}
