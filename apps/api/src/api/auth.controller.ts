import { Body, Controller, Post } from '@nestjs/common';
import { AuthService, TokenPair } from '../services/auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  signup(@Body() dto: SignupDto): Promise<TokenPair> {
    return this.authService.signup(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.authService.login(dto);
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
}
