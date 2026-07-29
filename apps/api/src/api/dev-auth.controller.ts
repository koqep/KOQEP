import { Controller, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

// M0'ın seed'lenmiş dev-login'i kimlik doğrulaması istemiyor (M1'e kadar
// bilinçli bir kapsam kararı). Bu controller sadece ENABLE_DEV_LOGIN=true
// iken kaydolur (bkz. app.module.ts) — gerçek /auth/signup ve /auth/login
// (AuthController) her zaman açık, bu ayrı dosyadadır ki ikisi karışmasın.
// Frontend gerçek signup/login akışına geçince bu dosya tamamen silinecek
// (bkz. docs/milestones/M1-auth-invites.md, görev: "Remove M0's seeded
// dev-login endpoint").
@Controller('auth')
export class DevAuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('dev-login')
  devLogin(): Promise<{ accessToken: string }> {
    return this.authService.issueDevLoginToken();
  }
}
