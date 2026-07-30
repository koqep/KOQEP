import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { InvitesService } from '../services/invites.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { UserThrottlerGuard } from './user-throttler.guard';

// Rate limiti burada @Throttle() ile değil, UserThrottlerGuard'ın kendi
// sabitleriyle uygulanıyor (bkz. o dosyadaki yorum - global APP_GUARD ile
// çakışmayı önlemek için). Global varsayılan (100/60s, IP bazlı) da ayrıca
// geçerli, bu route'a özel değil.
@Controller('invites')
@UseGuards(JwtAuthGuard, UserThrottlerGuard)
export class InvitesController {
  constructor(private readonly invitesService: InvitesService) {}

  @Post()
  createInvite(@Req() req: AuthenticatedRequest): Promise<{ code: string }> {
    return this.invitesService.createInvite(req.user.sub);
  }
}
