import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  MessageEditDto,
  MessagePage,
  MessagesService,
} from '../services/messages.service';
import { ReportsService } from '../services/reports.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { ReportThrottlerGuard } from './report-throttler.guard';
import { ReportMessageDto } from './dto/report-message.dto';

@Controller('rooms/:name/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(
    private readonly messagesService: MessagesService,
    private readonly reportsService: ReportsService,
  ) {}

  @Get()
  getRecentMessages(
    @Req() req: AuthenticatedRequest,
    @Param('name') name: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<MessagePage> {
    const parsedLimit =
      limit && !Number.isNaN(Number(limit)) ? Number(limit) : undefined;
    return this.messagesService.getRecentMessages(
      name,
      req.user.sub,
      cursor,
      parsedLimit,
    );
  }

  @Get(':id/edits')
  getMessageEditHistory(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ): Promise<MessageEditDto[]> {
    return this.messagesService.getMessageEditHistory(req.user.sub, id);
  }

  @Post(':id/report')
  @UseGuards(ReportThrottlerGuard)
  async reportMessage(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ReportMessageDto,
  ): Promise<{ ok: true }> {
    // dto tamamen boş bir istek gövdesinde (Content-Type/body hiç
    // gönderilmemişse) undefined olabilir - reason zaten opsiyonel,
    // gövdenin kendisi de opsiyonel olmalı.
    await this.reportsService.createReport(req.user.sub, id, dto?.reason);
    return { ok: true };
  }
}
