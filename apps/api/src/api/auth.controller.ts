import {
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, TokenPair } from '../services/auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthenticatedRequest } from './jwt-auth.guard';
import {
  REFRESH_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  buildRefreshCookieOptions,
  buildCsrfCookieOptions,
  buildClearCookieOptions,
  generateCsrfToken,
  parseCookieHeader,
} from '../services/auth-cookie.util';

// Davet kodu tahmin etme denemelerine karşı ikincil katman (THREAT-MODEL
// satır 9) - asıl savunma kodun entropisi, bu sadece otomatik/hızlı
// deneme trafiğini kesiyor.
const SIGNUP_ATTEMPT_LIMIT = 20;
const SIGNUP_ATTEMPT_TTL_MS = 60 * 1000;
const CSRF_HEADER_NAME = 'x-csrf-token';

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
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenPair> {
    const tokens = await this.authService.login(dto);
    this.setAuthCookies(response, tokens.refreshToken);
    return tokens;
  }

  @Post('verify-email')
  async verifyEmail(@Body() dto: VerifyEmailDto): Promise<{ ok: true }> {
    await this.authService.confirmEmailVerification(dto.token);
    return { ok: true };
  }

  @Post('refresh')
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<TokenPair> {
    const refreshToken = this.resolveRefreshToken(dto, req);
    const tokens = await this.authService.refresh(refreshToken);
    this.setAuthCookies(response, tokens.refreshToken);
    return tokens;
  }

  @Post('logout')
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<{ ok: true }> {
    const refreshToken = this.resolveRefreshToken(dto, req);
    await this.authService.logout(refreshToken);
    this.clearAuthCookies(response);
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
      dto.redactMessageContent,
    );
    return { ok: true };
  }

  private setAuthCookies(response: Response, refreshToken: string): void {
    response.cookie(
      REFRESH_COOKIE_NAME,
      refreshToken,
      buildRefreshCookieOptions(),
    );
    response.cookie(
      CSRF_COOKIE_NAME,
      generateCsrfToken(),
      buildCsrfCookieOptions(process.env.WEB_ORIGIN),
    );
  }

  private clearAuthCookies(response: Response): void {
    response.cookie(
      REFRESH_COOKIE_NAME,
      '',
      buildClearCookieOptions(buildRefreshCookieOptions()),
    );
    response.cookie(
      CSRF_COOKIE_NAME,
      '',
      buildClearCookieOptions(buildCsrfCookieOptions(process.env.WEB_ORIGIN)),
    );
  }

  // Body'de refreshToken varsa (mobil/bearer istemci) CSRF kontrolü
  // ATLANIR - bir CSRF saldırı sayfası bu değeri BİLEMEZ, ambient
  // cookie'nin aksine. Web istemcisi body GÖNDERMEZ, cookie+CSRF-header
  // yoluna düşer (bkz. ADR-0002 Addendum).
  private resolveRefreshToken(dto: RefreshDto, req: Request): string {
    if (dto.refreshToken) {
      return dto.refreshToken;
    }

    const cookies = parseCookieHeader(req.headers.cookie);
    const refreshToken = cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) {
      throw new UnauthorizedException(
        'Geçersiz veya süresi dolmuş refresh token.',
      );
    }

    const csrfCookie = cookies[CSRF_COOKIE_NAME];
    const csrfHeader = req.headers[CSRF_HEADER_NAME];
    if (
      !csrfCookie ||
      typeof csrfHeader !== 'string' ||
      csrfHeader !== csrfCookie
    ) {
      throw new ForbiddenException('CSRF doğrulaması başarısız.');
    }

    return refreshToken;
  }
}
