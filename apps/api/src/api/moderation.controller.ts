import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ReportsService, ReportSummary } from '../services/reports.service';
import { MessagesGateway } from './messages.gateway';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { ModeratorGuard } from './moderator.guard';

@Controller('moderation')
@UseGuards(JwtAuthGuard, ModeratorGuard)
export class ModerationController {
  constructor(
    private readonly reportsService: ReportsService,
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
}
