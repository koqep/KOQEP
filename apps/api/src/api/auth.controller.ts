import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService, TokenPair } from '../services/auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';

// Davet kodu tahmin etme denemelerine karşı ikincil katman (THREAT-MODEL
// satır 9) - asıl savunma kodun entropisi, bu sadece otomatik/hızlı
// deneme trafiğini kesiyor.
const SIGNUP_ATTEMPT_LIMIT = 20;
const SIGNUP_ATTEMPT_TTL_MS = 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Throttle({
    default: { limit: SIGNUP_ATTEMPT_LIMIT, ttl: SIGNUP_ATTEMPT_TTL_MS },
  })
  async signup(@Body() dto: SignupDto): Promise<{ ok: true }> {
    await this.authService.signup(dto);
    return { ok: true };
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authService.login(dto);
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ ok: true }> {
    await this.authService.confirmEmailVerification(dto.token);
    return { ok: true };
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshDto): Promise<TokenPair> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  async logout(@Body() dto: RefreshDto): Promise<{ ok: true }> {
    await this.authService.logout(dto.refreshToken);
    return { ok: true };
  }

  @Post('delete-account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DeleteAccountDto,
  ): Promise<{ ok: true }> {
    await this.authService.deleteAccount(
      req.user.sub,
      dto.password,
      dto.totpCode,
    );
    return { ok: true };
  }
}
