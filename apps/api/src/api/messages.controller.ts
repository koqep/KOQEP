import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { MessagePage, MessagesService } from '../services/messages.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('rooms/:name/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  getRecentMessages(
    @Param('name') name: string,
    @Query('cursor') cursor?: string,
    @Query('limit') limit?: string,
  ): Promise<MessagePage> {
    const parsedLimit =
      limit && !Number.isNaN(Number(limit)) ? Number(limit) : undefined;
    return this.messagesService.getRecentMessages(name, cursor, parsedLimit);
  }
}
