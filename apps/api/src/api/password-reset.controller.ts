import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from '../services/auth.service';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';

@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly authService: AuthService) {}

  @Post('request')
  async request(@Body() dto: RequestPasswordResetDto): Promise<{ ok: true }> {
    await this.authService.requestPasswordReset(dto.email);
    return { ok: true };
  }

  @Post('confirm')
  async confirm(@Body() dto: ConfirmPasswordResetDto): Promise<{ ok: true }> {
    await this.authService.confirmPasswordReset(dto.token, dto.newPassword);
    return { ok: true };
  }
}
