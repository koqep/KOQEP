import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import { TotpCodeDto } from './dto/totp-code.dto';
import { TotpService } from '../services/totp.service';
import type { TotpSetup } from '../services/totp.service';

@Controller('auth/totp')
@UseGuards(JwtAuthGuard)
export class TotpController {
  constructor(private readonly totpService: TotpService) {}

  @Post('setup')
  async setup(@Req() req: AuthenticatedRequest): Promise<TotpSetup> {
    const setup = this.totpService.generateSecret(req.user.email);
    await this.totpService.savePendingSecret(req.user.sub, setup.secret);
    return setup;
  }

  @Post('enable')
  enable(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TotpCodeDto,
  ): Promise<string[]> {
    return this.totpService.confirmEnable(req.user.sub, dto.totpCode);
  }

  @Post('disable')
  async disable(
    @Req() req: AuthenticatedRequest,
    @Body() dto: TotpCodeDto,
  ): Promise<{ ok: true }> {
    await this.totpService.disable(req.user.sub, dto.totpCode);
    return { ok: true };
  }
}
