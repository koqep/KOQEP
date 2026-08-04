import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { InvitesService, InviteSummary } from '../services/invites.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

// M4 Slice B: manuel oluşturma (POST) kaldırıldı - davetler artık sadece
// seviye atlayınca otomatik kazanılıyor (MessagesService.sendMessage'ın
// transaction'ı içinde, bkz. InvitesService.grantInvites). UserThrottlerGuard
// bu yüzden gereksizleşti ve dosyasıyla birlikte silindi.
@Controller('invites')
@UseGuards(JwtAuthGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Get()
  listMyInvites(@Req() req: AuthenticatedRequest): Promise<InviteSummary[]> {
    return this.invitesService.listInvites(req.user.sub);
  }
}
