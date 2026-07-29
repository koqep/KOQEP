import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { BlockUserDto } from './dto/block-user.dto';
import { BlocksService } from '../services/blocks.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class BlocksController {
  constructor(private readonly blocksService: BlocksService) {}

  @Post('block')
  async block(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BlockUserDto,
  ): Promise<{ ok: true }> {
    await this.blocksService.block(req.user.sub, dto.email);
    return { ok: true };
  }

  @Post('unblock')
  async unblock(
    @Req() req: AuthenticatedRequest,
    @Body() dto: BlockUserDto,
  ): Promise<{ ok: true }> {
    await this.blocksService.unblock(req.user.sub, dto.email);
    return { ok: true };
  }

  @Get('blocked')
  listBlocked(@Req() req: AuthenticatedRequest): Promise<string[]> {
    return this.blocksService.listBlockedEmails(req.user.sub);
  }
}
