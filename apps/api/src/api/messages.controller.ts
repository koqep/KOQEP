import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import {
  MessageEditDto,
  MessagePage,
  MessagesService,
} from '../services/messages.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Controller('rooms/:name/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

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
}
