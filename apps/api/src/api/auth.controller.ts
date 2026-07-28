import { Controller, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('dev-login')
  devLogin(): Promise<{ accessToken: string }> {
    return this.authService.issueDevLoginToken();
  }
}
