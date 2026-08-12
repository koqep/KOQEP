import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { MeService, UserExportDto } from '../services/me.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('export')
  exportMyData(@Req() req: AuthenticatedRequest): Promise<UserExportDto> {
    return this.meService.exportUserData(req.user.sub);
  }
}
