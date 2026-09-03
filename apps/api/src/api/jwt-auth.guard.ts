import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, INVALID_TOKEN_CODE } from '../services/auth.service';
import { Locale, DEFAULT_LOCALE } from '../db/locale.constants';

export interface AuthenticatedRequest extends Request {
  user: { sub: string; email: string; locale: Locale };
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException({
        code: INVALID_TOKEN_CODE,
        message: 'Authorization header eksik.',
      });
    }

    const payload = await this.authService.verifyAccessToken(token);
    // M9 Slice B: deploy anında aktif eski token'ların locale claim'i YOK
    // (henüz yenilenmediler) - burada TEK bir yerde çözümlemek, her
    // gelecekteki tüketicinin (Slice C) kendi başına `?? DEFAULT_LOCALE`
    // hatırlamasına güvenmekten daha sağlam. 15dk TTL içinde kendiliğinden
    // düzelir (bkz. locale.constants.ts).
    request.user = { ...payload, locale: payload.locale ?? DEFAULT_LOCALE };
    return true;
  }
}

function extractBearerToken(header: string | undefined): string | null {
  if (!header?.startsWith('Bearer ')) {
    return null;
  }
  return header.slice('Bearer '.length);
}
